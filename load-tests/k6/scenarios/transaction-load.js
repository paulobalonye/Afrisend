/**
 * Load Test: Transaction Initiation — 10,000 Concurrent Transactions
 *
 * Scenario: Ramp up to 10,000 virtual users (VUs) submitting send-money
 * transactions simultaneously. Validates the POST /v1/transactions endpoint
 * under extreme concurrency.
 *
 * SLO: p95 < 500ms, error rate < 1%
 *
 * Usage:
 *   k6 run load-tests/k6/scenarios/transaction-load.js
 *   K6_BASE_URL=https://api.afrisend.com k6 run load-tests/k6/scenarios/transaction-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { login, authHeaders } from '../helpers/auth.js';
import { BASE_URL, uuidv4, randomAmount, randomItem, CORRIDORS } from '../helpers/utils.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const transactionDuration = new Trend('transaction_initiation_ms', true);
const transactionErrors = new Counter('transaction_errors_total');
const transactionSuccessRate = new Rate('transaction_success_rate');
const idempotencyCollisions = new Counter('idempotency_collisions_total');

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    transaction_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Warm-up: gradually increase to 1,000 VUs over 2 minutes
        { duration: '2m', target: 1000 },
        // Scale: ramp to 5,000 VUs over 3 minutes
        { duration: '3m', target: 5000 },
        // Peak: hold at 10,000 VUs for 5 minutes (full load)
        { duration: '5m', target: 10000 },
        // Sustained: hold at 10,000 VUs for 2 more minutes
        { duration: '2m', target: 10000 },
        // Cool-down: ramp down over 2 minutes
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // p95 of transaction initiation must be < 500ms
    transaction_initiation_ms: [
      { threshold: 'p(95)<500', abortOnFail: false },
      { threshold: 'p(99)<1500', abortOnFail: false },
    ],
    // Overall HTTP error rate < 1%
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: false }],
    // Transaction success rate > 99%
    transaction_success_rate: [{ threshold: 'rate>0.99', abortOnFail: false }],
    // p95 of all HTTP requests < 600ms (includes auth overhead)
    http_req_duration: [{ threshold: 'p(95)<600', abortOnFail: false }],
  },

  // Capture summary to file for baseline comparison
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// ─── VU lifecycle ─────────────────────────────────────────────────────────────

// Test data pool — pre-seeded test users
// In real environments, use __ENV.TEST_USER_EMAIL / TEST_USER_PASSWORD
const TEST_USERS = [
  { email: __ENV.TEST_USER_EMAIL || 'loadtest+1@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
  { email: __ENV.TEST_USER_EMAIL_2 || 'loadtest+2@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
  { email: __ENV.TEST_USER_EMAIL_3 || 'loadtest+3@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
];

// Per-VU state
let vuToken = null;

export function setup() {
  // Verify the API is reachable before starting the load test
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: status=${healthRes.status}`);
  }
  console.log(`Load test target: ${BASE_URL}`);
  console.log('Health check passed — starting transaction load test');
  return { baseUrl: BASE_URL };
}

export default function () {
  // Lazy-initialize token per VU (not in init to respect VU-level isolation)
  if (!vuToken) {
    const user = randomItem(TEST_USERS);
    try {
      vuToken = login(user.email, user.password);
    } catch (err) {
      transactionErrors.add(1);
      sleep(1);
      return;
    }
  }

  const corridor = randomItem(CORRIDORS);
  const amount = randomAmount(10, 1000);
  const fxRate = randomAmount(700, 1600); // rough NGN/USD range

  group('transaction_initiate', () => {
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
      headers: authHeaders(vuToken),
      tags: { name: 'transaction_initiate' },
    });
    const elapsed = Date.now() - startTime;

    transactionDuration.add(elapsed);

    const success = check(res, {
      'transaction status 201': (r) => r.status === 201,
      'transaction has id': (r) => {
        try {
          return Boolean(JSON.parse(r.body).data?.id);
        } catch (_) {
          return false;
        }
      },
      'transaction response time < 500ms': () => elapsed < 500,
    });

    transactionSuccessRate.add(success);

    if (!success) {
      transactionErrors.add(1);

      // Handle token expiry — refresh on 401
      if (res.status === 401) {
        vuToken = null;
        return;
      }

      // Count idempotency key collisions separately (expected under extreme concurrency)
      if (res.status === 409) {
        idempotencyCollisions.add(1);
      }
    }
  });

  // Minimal think time — 100ms to simulate client-side processing
  sleep(0.1);
}

export function teardown(data) {
  console.log(`Transaction load test complete against ${data.baseUrl}`);
}

export function handleSummary(data) {
  const p95 = data.metrics['transaction_initiation_ms']?.values?.['p(95)'] ?? 'N/A';
  const p99 = data.metrics['transaction_initiation_ms']?.values?.['p(99)'] ?? 'N/A';
  const errorRate = data.metrics['transaction_errors_total']?.values?.count ?? 0;
  const successRate = data.metrics['transaction_success_rate']?.values?.rate ?? 0;

  console.log('\n======= TRANSACTION LOAD TEST SUMMARY =======');
  console.log(`p95 initiation time: ${p95}ms  (SLO: <500ms)`);
  console.log(`p99 initiation time: ${p99}ms  (SLO: <1500ms)`);
  console.log(`Total errors: ${errorRate}`);
  console.log(`Success rate: ${(successRate * 100).toFixed(2)}%  (SLO: >99%)`);
  console.log('==============================================\n');

  return {
    'load-tests/reports/transaction-load-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
