/**
 * Load Test: FX Rate Engine — Concurrent Quote Requests
 *
 * Tests the POST /v1/fx/quote endpoint (quote creation) and
 * GET /v1/fx/rates (current rates) under high concurrency.
 *
 * SLO: FX quote p99 < 200ms, error rate < 1%
 *
 * Usage:
 *   k6 run load-tests/k6/scenarios/fx-quotes-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, uuidv4, randomAmount, randomItem, CORRIDORS } from '../helpers/utils.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const fxQuoteDuration = new Trend('fx_quote_creation_ms', true);
const fxRateFetchDuration = new Trend('fx_rate_fetch_ms', true);
const fxErrors = new Counter('fx_errors_total');
const fxQuoteSuccessRate = new Rate('fx_quote_success_rate');
const fxQuoteLockDuration = new Trend('fx_quote_lock_ms', true);

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    fx_quote_load: {
      executor: 'ramping-arrival-rate',
      startRate: 100,        // 100 requests/second at start
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 3000,
      stages: [
        // Warm-up
        { duration: '1m', target: 200 },
        // Scale to 1,000 rps
        { duration: '2m', target: 1000 },
        // Peak: 2,000 rps for 5 minutes
        { duration: '5m', target: 2000 },
        // Cool-down
        { duration: '1m', target: 100 },
      ],
    },

    fx_rate_read_load: {
      // Simulates mobile clients polling current rates
      executor: 'constant-arrival-rate',
      rate: 500,            // 500 read requests/second (steady)
      timeUnit: '1s',
      duration: '9m',
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },

  thresholds: {
    // FX quote creation p99 < 200ms (strict SLO from HIT-80)
    fx_quote_creation_ms: [
      { threshold: 'p(99)<200', abortOnFail: false },
      { threshold: 'p(95)<150', abortOnFail: false },
    ],
    // Rate fetch should be very fast (cached data)
    fx_rate_fetch_ms: [
      { threshold: 'p(99)<50', abortOnFail: false },
    ],
    // Quote lock should be fast (database operation)
    fx_quote_lock_ms: [
      { threshold: 'p(95)<100', abortOnFail: false },
    ],
    // Overall error rate < 1%
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: false }],
    fx_quote_success_rate: [{ threshold: 'rate>0.99', abortOnFail: false }],
  },

  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// ─── Test scenarios ───────────────────────────────────────────────────────────

export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }

  // Verify FX rates endpoint is available
  const ratesRes = http.get(`${BASE_URL}/v1/fx/rates`, { headers: DEFAULT_HEADERS });
  if (ratesRes.status !== 200) {
    console.warn(`FX rates pre-check returned ${ratesRes.status} — continuing anyway`);
  }

  return { baseUrl: BASE_URL };
}

export default function () {
  // Determine which scenario this VU is running
  const scenario = __ENV.K6_SCENARIO_NAME;

  if (scenario === 'fx_rate_read_load') {
    runRatesFetch();
  } else {
    runQuoteCreation();
  }
}

function runRatesFetch() {
  group('fx_rates_fetch', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/v1/fx/rates`, {
      headers: DEFAULT_HEADERS,
      tags: { name: 'fx_fetch_rates' },
    });
    const elapsed = Date.now() - startTime;

    fxRateFetchDuration.add(elapsed);

    check(res, {
      'fx rates 200': (r) => r.status === 200,
      'fx rates has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && Array.isArray(body.data);
        } catch (_) {
          return false;
        }
      },
      'fx rates response time < 50ms': () => elapsed < 50,
    });
  });

  sleep(0.05);
}

function runQuoteCreation() {
  const corridor = randomItem(CORRIDORS);
  const amount = randomAmount(50, 2000);
  const direction = randomItem(['send', 'receive']);

  let quoteId = null;

  group('fx_create_quote', () => {
    const payload = JSON.stringify({
      from_currency: corridor.from,
      to_currency: corridor.to,
      amount,
      direction,
    });

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/v1/fx/quote`, payload, {
      headers: DEFAULT_HEADERS,
      tags: { name: 'fx_create_quote' },
    });
    const elapsed = Date.now() - startTime;

    fxQuoteDuration.add(elapsed);

    const success = check(res, {
      'fx quote 201': (r) => r.status === 201,
      'fx quote has id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Boolean(body.data?.id);
        } catch (_) {
          return false;
        }
      },
      'fx quote has rate': (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.data?.rate === 'number';
        } catch (_) {
          return false;
        }
      },
      'fx quote response time < 200ms (p99 SLO)': () => elapsed < 200,
    });

    fxQuoteSuccessRate.add(success);

    if (!success) {
      fxErrors.add(1);
      sleep(0.2);
      return;
    }

    try {
      quoteId = JSON.parse(res.body).data.id;
    } catch (_) {
      fxErrors.add(1);
    }
  });

  // ~20% of successful quotes proceed to lock (simulating users proceeding to payment)
  if (quoteId && Math.random() < 0.2) {
    group('fx_lock_quote', () => {
      const startTime = Date.now();
      const res = http.post(`${BASE_URL}/v1/fx/quote/${quoteId}/lock`, null, {
        headers: DEFAULT_HEADERS,
        tags: { name: 'fx_lock_quote' },
      });
      const elapsed = Date.now() - startTime;

      fxQuoteLockDuration.add(elapsed);

      check(res, {
        'fx lock 200 or 409 or 410': (r) => r.status === 200 || r.status === 409 || r.status === 410,
        'fx lock response time < 100ms': () => elapsed < 100,
      });
    });
  }

  sleep(0.1);
}

export function teardown(data) {
  console.log(`FX load test complete against ${data.baseUrl}`);
}

export function handleSummary(data) {
  const quoteP99 = data.metrics['fx_quote_creation_ms']?.values?.['p(99)'] ?? 'N/A';
  const quoteP95 = data.metrics['fx_quote_creation_ms']?.values?.['p(95)'] ?? 'N/A';
  const rateP99 = data.metrics['fx_rate_fetch_ms']?.values?.['p(99)'] ?? 'N/A';
  const lockP95 = data.metrics['fx_quote_lock_ms']?.values?.['p(95)'] ?? 'N/A';
  const errorCount = data.metrics['fx_errors_total']?.values?.count ?? 0;
  const successRate = data.metrics['fx_quote_success_rate']?.values?.rate ?? 0;

  console.log('\n======= FX LOAD TEST SUMMARY =======');
  console.log(`Quote creation p99: ${quoteP99}ms  (SLO: <200ms)`);
  console.log(`Quote creation p95: ${quoteP95}ms  (SLO: <150ms)`);
  console.log(`Rate fetch p99:     ${rateP99}ms  (SLO: <50ms)`);
  console.log(`Quote lock p95:     ${lockP95}ms  (SLO: <100ms)`);
  console.log(`Total FX errors:    ${errorCount}`);
  console.log(`Success rate:       ${(successRate * 100).toFixed(2)}%  (SLO: >99%)`);
  console.log('=====================================\n');

  return {
    'load-tests/reports/fx-load-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
