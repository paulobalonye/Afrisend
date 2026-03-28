/**
 * AfriSend Full Performance Test Suite
 *
 * Orchestrates all performance scenarios in a single k6 run using
 * the scenarios executor. This is the primary CI entry point.
 *
 * Scenarios run in parallel (with staggered start times to avoid
 * thundering-herd at test startup):
 *
 *   1. transaction_load     — 10k concurrent transaction initiations
 *   2. fx_quote_load        — FX quote creation at 2000 rps
 *   3. fx_rate_read         — FX rate polling (background read load)
 *   4. kyc_throughput       — KYC session creation and submission
 *
 * Rate limiting validation is a separate run (requires Kong in the path)
 * and is NOT included here to avoid confounding latency metrics.
 *
 * SLOs (from HIT-80):
 *   - Transaction initiation p95 < 500ms
 *   - FX quote p99 < 200ms
 *   - KYC submit p95 < 3,000ms
 *   - HTTP error rate < 1% for transactions/FX, < 5% for KYC
 *
 * Usage:
 *   k6 run load-tests/k6/full-suite.js
 *   K6_BASE_URL=https://staging.afrisend.com k6 run load-tests/k6/full-suite.js
 *
 * Output:
 *   load-tests/reports/full-suite-summary.json
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { login, authHeaders } from './helpers/auth.js';
import { BASE_URL, DEFAULT_HEADERS, uuidv4, randomAmount, randomItem, CORRIDORS } from './helpers/utils.js';

// ─── Custom metrics (all scenarios) ──────────────────────────────────────────
const txInitDuration = new Trend('tx_init_ms', true);
const fxQuoteDuration = new Trend('fx_quote_ms', true);
const fxRateDuration = new Trend('fx_rate_ms', true);
const kycSessionDuration = new Trend('kyc_session_ms', true);
const kycSubmitDuration = new Trend('kyc_submit_ms', true);

const txErrors = new Counter('tx_errors');
const fxErrors = new Counter('fx_errors');
const kycErrors = new Counter('kyc_errors');

const txSuccessRate = new Rate('tx_success_rate');
const fxSuccessRate = new Rate('fx_success_rate');
const kycSuccessRate = new Rate('kyc_success_rate');

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // ── Scenario 1: Transaction load ─────────────────────────────────────────
    transaction_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 },
        { duration: '3m', target: 5000 },
        { duration: '5m', target: 10000 },
        { duration: '2m', target: 10000 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'runTransaction',
    },

    // ── Scenario 2: FX quote creation ────────────────────────────────────────
    fx_quote_load: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 3000,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '3m', target: 1000 },
        { duration: '5m', target: 2000 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      exec: 'runFxQuote',
    },

    // ── Scenario 3: FX rate polling (background) ──────────────────────────────
    fx_rate_read: {
      executor: 'constant-arrival-rate',
      rate: 300,
      timeUnit: '1s',
      duration: '14m',
      preAllocatedVUs: 50,
      maxVUs: 150,
      exec: 'runFxRates',
    },

    // ── Scenario 4: KYC throughput ────────────────────────────────────────────
    kyc_throughput: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 200 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'runKyc',
    },
  },

  // ── Thresholds (all scenarios combined) ──────────────────────────────────────
  thresholds: {
    // Transaction SLOs
    tx_init_ms: [
      { threshold: 'p(95)<500', abortOnFail: false },
      { threshold: 'p(99)<1500', abortOnFail: false },
    ],
    tx_success_rate: [{ threshold: 'rate>0.99', abortOnFail: false }],

    // FX SLOs
    fx_quote_ms: [
      { threshold: 'p(99)<200', abortOnFail: false },
      { threshold: 'p(95)<150', abortOnFail: false },
    ],
    fx_rate_ms: [{ threshold: 'p(99)<50', abortOnFail: false }],
    fx_success_rate: [{ threshold: 'rate>0.99', abortOnFail: false }],

    // KYC SLOs
    kyc_submit_ms: [
      { threshold: 'p(95)<3000', abortOnFail: false },
      { threshold: 'p(99)<8000', abortOnFail: false },
    ],
    kyc_success_rate: [{ threshold: 'rate>0.95', abortOnFail: false }],

    // Global HTTP error rate
    http_req_failed: [{ threshold: 'rate<0.02', abortOnFail: false }],
  },

  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// ─── Test users ───────────────────────────────────────────────────────────────
const TEST_USERS = [
  { email: __ENV.TEST_USER_EMAIL || 'loadtest+1@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
  { email: __ENV.TEST_USER_EMAIL_2 || 'loadtest+2@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
  { email: __ENV.TEST_USER_EMAIL_3 || 'loadtest+3@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
];

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: status=${healthRes.status} — aborting load test`);
  }

  // Verify FX rates are accessible
  const fxRes = http.get(`${BASE_URL}/v1/fx/rates`, { headers: DEFAULT_HEADERS });
  const fxOk = fxRes.status === 200;

  console.log(`\n====== AFRISEND PERFORMANCE TEST SUITE ======`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Health: OK`);
  console.log(`FX rates accessible: ${fxOk}`);
  console.log(`Peak transaction VUs: 10,000`);
  console.log(`Peak FX quote rate: 2,000 rps`);
  console.log(`Peak KYC VUs: 500`);
  console.log(`=============================================\n`);

  return { baseUrl: BASE_URL };
}

// ─── Per-VU token cache ───────────────────────────────────────────────────────
let _token = null;

function getToken() {
  if (!_token) {
    const user = randomItem(TEST_USERS);
    _token = login(user.email, user.password);
  }
  return _token;
}

function clearToken() {
  _token = null;
}

// ─── Scenario executors ───────────────────────────────────────────────────────

export function runTransaction() {
  let token;
  try {
    token = getToken();
  } catch (_) {
    txErrors.add(1);
    sleep(1);
    return;
  }

  const corridor = randomItem(CORRIDORS);
  const amount = randomAmount(10, 1000);
  const fxRate = randomAmount(700, 1600);

  const payload = JSON.stringify({
    idempotencyKey: uuidv4(),
    amount,
    currency: corridor.from,
    targetAmount: Math.round(amount * fxRate * 100) / 100,
    targetCurrency: corridor.to,
    fxRate,
    payoutRail: 'bank_transfer',
    corridorId: `${corridor.from}_${corridor.to}`,
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/v1/transactions`, payload, {
    headers: authHeaders(token),
    tags: { name: 'tx_initiate', scenario: 'transaction_load' },
  });
  const elapsed = Date.now() - startTime;

  txInitDuration.add(elapsed);

  const success = check(res, {
    'tx 201': (r) => r.status === 201,
    'tx has id': (r) => {
      try { return Boolean(JSON.parse(r.body).data?.id); } catch (_) { return false; }
    },
  });

  txSuccessRate.add(success);
  if (!success) {
    txErrors.add(1);
    if (res.status === 401) clearToken();
  }

  sleep(0.1);
}

export function runFxQuote() {
  const corridor = randomItem(CORRIDORS);
  const amount = randomAmount(50, 2000);

  const payload = JSON.stringify({
    from_currency: corridor.from,
    to_currency: corridor.to,
    amount,
    direction: 'send',
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/v1/fx/quote`, payload, {
    headers: DEFAULT_HEADERS,
    tags: { name: 'fx_quote', scenario: 'fx_quote_load' },
  });
  const elapsed = Date.now() - startTime;

  fxQuoteDuration.add(elapsed);

  const success = check(res, {
    'fx quote 201': (r) => r.status === 201,
    'fx quote has rate': (r) => {
      try { return typeof JSON.parse(r.body).data?.rate === 'number'; } catch (_) { return false; }
    },
  });

  fxSuccessRate.add(success);
  if (!success) fxErrors.add(1);

  sleep(0.05);
}

export function runFxRates() {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/v1/fx/rates`, {
    headers: DEFAULT_HEADERS,
    tags: { name: 'fx_rates', scenario: 'fx_rate_read' },
  });
  const elapsed = Date.now() - startTime;

  fxRateDuration.add(elapsed);

  check(res, {
    'fx rates 200': (r) => r.status === 200,
  });

  sleep(0.05);
}

export function runKyc() {
  let token;
  try {
    token = getToken();
  } catch (_) {
    kycErrors.add(1);
    sleep(1);
    return;
  }

  // Step 1: Create session
  const startCreate = Date.now();
  const createRes = http.post(`${BASE_URL}/v1/kyc/sessions`, null, {
    headers: authHeaders(token),
    tags: { name: 'kyc_create', scenario: 'kyc_throughput' },
  });
  kycSessionDuration.add(Date.now() - startCreate);

  if (createRes.status !== 200) {
    kycErrors.add(1);
    if (createRes.status === 401) clearToken();
    sleep(0.5);
    return;
  }

  let sessionId;
  try {
    sessionId = JSON.parse(createRes.body).data?.sessionId;
  } catch (_) {
    kycErrors.add(1);
    return;
  }

  if (!sessionId) {
    kycErrors.add(1);
    return;
  }

  sleep(0.1);

  // Step 2: Submit session
  const startSubmit = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/v1/kyc/sessions/${sessionId}/submit`,
    null,
    {
      headers: authHeaders(token),
      tags: { name: 'kyc_submit', scenario: 'kyc_throughput' },
    }
  );
  const submitElapsed = Date.now() - startSubmit;

  kycSubmitDuration.add(submitElapsed);

  const success = check(submitRes, {
    'kyc submit 200': (r) => r.status === 200,
  });

  kycSuccessRate.add(success);
  if (!success) {
    kycErrors.add(1);
    if (submitRes.status === 401) clearToken();
  }

  sleep(0.5);
}

// ─── Teardown and reporting ───────────────────────────────────────────────────
export function teardown(data) {
  console.log(`\nFull suite complete against ${data.baseUrl}`);
}

export function handleSummary(data) {
  const metrics = data.metrics;

  const results = {
    slo: {
      transaction_initiation_p95_ms: metrics['tx_init_ms']?.values?.['p(95)'] ?? null,
      transaction_initiation_p99_ms: metrics['tx_init_ms']?.values?.['p(99)'] ?? null,
      transaction_success_rate: metrics['tx_success_rate']?.values?.rate ?? null,
      fx_quote_p95_ms: metrics['fx_quote_ms']?.values?.['p(95)'] ?? null,
      fx_quote_p99_ms: metrics['fx_quote_ms']?.values?.['p(99)'] ?? null,
      fx_rate_fetch_p99_ms: metrics['fx_rate_ms']?.values?.['p(99)'] ?? null,
      fx_success_rate: metrics['fx_success_rate']?.values?.rate ?? null,
      kyc_submit_p95_ms: metrics['kyc_submit_ms']?.values?.['p(95)'] ?? null,
      kyc_submit_p99_ms: metrics['kyc_submit_ms']?.values?.['p(99)'] ?? null,
      kyc_success_rate: metrics['kyc_success_rate']?.values?.rate ?? null,
      global_http_error_rate: metrics['http_req_failed']?.values?.rate ?? null,
    },
    targets: {
      transaction_initiation_p95_ms: 500,
      fx_quote_p99_ms: 200,
      kyc_submit_p95_ms: 3000,
      http_error_rate_max: 0.02,
    },
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL,
  };

  // Evaluate pass/fail per SLO
  const txPass = results.slo.transaction_initiation_p95_ms !== null && results.slo.transaction_initiation_p95_ms < 500;
  const fxPass = results.slo.fx_quote_p99_ms !== null && results.slo.fx_quote_p99_ms < 200;
  const kycPass = results.slo.kyc_submit_p95_ms !== null && results.slo.kyc_submit_p95_ms < 3000;

  console.log('\n======= FULL SUITE PERFORMANCE SUMMARY =======');
  console.log(`Transaction initiation p95: ${results.slo.transaction_initiation_p95_ms}ms  (SLO: <500ms) ${txPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`FX quote p99:               ${results.slo.fx_quote_p99_ms}ms  (SLO: <200ms) ${fxPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`KYC submit p95:             ${results.slo.kyc_submit_p95_ms}ms  (SLO: <3000ms) ${kycPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Global HTTP error rate:     ${((results.slo.global_http_error_rate ?? 0) * 100).toFixed(2)}%`);
  console.log(`TX success rate:            ${((results.slo.transaction_success_rate ?? 0) * 100).toFixed(2)}%`);
  console.log(`FX success rate:            ${((results.slo.fx_success_rate ?? 0) * 100).toFixed(2)}%`);
  console.log(`KYC success rate:           ${((results.slo.kyc_success_rate ?? 0) * 100).toFixed(2)}%`);
  console.log('===============================================\n');

  return {
    'load-tests/reports/full-suite-summary.json': JSON.stringify({ ...results, raw: data }, null, 2),
    'load-tests/reports/slo-results.json': JSON.stringify(results, null, 2),
    stdout: '',
  };
}
