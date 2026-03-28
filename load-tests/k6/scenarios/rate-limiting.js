/**
 * Load Test: API Gateway Rate Limiting Validation
 *
 * Validates that Kong rate limiting works correctly under load:
 *   - Global: 120 req/min per consumer, 2000/hr, 20000/day
 *   - Auth endpoints: 20 req/min per IP, 200/hr
 *
 * This test intentionally tries to exceed rate limits to verify:
 *   1. 429 responses are returned when limits are exceeded
 *   2. Rate limit headers are present (X-RateLimit-Remaining-*)
 *   3. The correct error message is returned
 *   4. Legitimate traffic resumes after the window resets
 *
 * NOTE: This test targets the Kong gateway (default port 8000), not the
 * Express server directly. Set K6_GATEWAY_URL to point at Kong.
 *
 * Usage:
 *   K6_GATEWAY_URL=http://localhost:8000 k6 run load-tests/k6/scenarios/rate-limiting.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Gauge } from 'k6/metrics';
import { DEFAULT_HEADERS, randomItem } from '../helpers/utils.js';

// The gateway URL — distinct from the backend URL
const GATEWAY_URL = __ENV.K6_GATEWAY_URL || 'http://localhost:8000';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const rateLimitHits = new Counter('rate_limit_429_total');
const rateLimitMissed = new Counter('rate_limit_bypass_total');
const authRateLimitHits = new Counter('auth_rate_limit_429_total');
const rateLimitHeaderPresent = new Rate('rate_limit_header_present');
const rateLimitResumed = new Rate('rate_limit_resumed_after_window');
const currentRateLimitRemaining = new Gauge('rate_limit_remaining');

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Burst above global rate limit (120 req/min = 2 req/sec)
    rate_limit_burst: {
      executor: 'constant-arrival-rate',
      rate: 10,          // 10 req/sec = 600 req/min — 5x the limit
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },

    // Scenario 2: Auth endpoint brute-force prevention
    auth_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 5,           // 5 req/sec = 300 req/min — 15x the auth limit
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      startTime: '2m30s', // Run after burst scenario
    },

    // Scenario 3: Recovery — verify traffic resumes after window reset
    rate_limit_recovery: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: '1m', target: 1 },   // Send slow traffic
        { duration: '30s', target: 0 },  // Full stop (let window reset)
        { duration: '30s', target: 1 },  // Resume — should succeed
      ],
      startTime: '5m',
    },
  },

  thresholds: {
    // Rate limit enforcement: we MUST see 429s when overloading
    rate_limit_429_total: [
      // At least 100 rate limit hits expected during burst scenario
      { threshold: 'count>100', abortOnFail: false },
    ],
    // Rate limit headers must be present on responses
    rate_limit_header_present: [
      { threshold: 'rate>0.9', abortOnFail: false },
    ],
    // After recovery window, traffic should succeed
    rate_limit_resumed_after_window: [
      { threshold: 'rate>0.8', abortOnFail: false },
    ],
  },

  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// Test consumers (pre-provisioned in Kong with known consumer IDs/keys)
const TEST_CONSUMERS = [
  { key: __ENV.KONG_JWT_KEY_1 || 'test-consumer-key-1' },
  { key: __ENV.KONG_JWT_KEY_2 || 'test-consumer-key-2' },
];

export function setup() {
  // Verify gateway is reachable
  const healthRes = http.get(`${GATEWAY_URL}/health`);
  const gatewayReachable = healthRes.status === 200 || healthRes.status === 404;

  if (!gatewayReachable) {
    console.warn(
      `WARNING: Kong gateway at ${GATEWAY_URL} returned ${healthRes.status}. ` +
      'Rate limiting tests may be running against backend directly (Kong not in path). ' +
      'Set K6_GATEWAY_URL to point at Kong for accurate rate limit testing.'
    );
  }

  return { gatewayUrl: GATEWAY_URL, gatewayReachable };
}

export default function (data) {
  const scenario = __ENV.K6_SCENARIO_NAME || 'rate_limit_burst';

  if (scenario === 'auth_rate_limit') {
    runAuthRateLimitTest();
  } else if (scenario === 'rate_limit_recovery') {
    runRecoveryTest();
  } else {
    runBurstRateLimitTest();
  }
}

function runBurstRateLimitTest() {
  const consumer = randomItem(TEST_CONSUMERS);

  group('rate_limit_validation', () => {
    // Hit a simple authenticated endpoint rapidly
    const res = http.get(`${GATEWAY_URL}/v1/fx/rates`, {
      headers: {
        ...DEFAULT_HEADERS,
        // Use a fake consumer key — Kong will rate-limit by consumer
        Authorization: `Bearer ${consumer.key}`,
      },
      tags: { name: 'rate_limit_burst_fx_rates' },
    });

    // Extract rate limit remaining header
    const remaining = parseInt(res.headers['X-RateLimit-Remaining-Minute'] || '-1', 10);
    if (remaining >= 0) {
      currentRateLimitRemaining.add(remaining);
    }

    // Check for rate limit headers
    const hasRateLimitHeaders = check(res, {
      'has RateLimit-Remaining header': (r) =>
        r.headers['X-RateLimit-Remaining-Minute'] !== undefined ||
        r.headers['X-RateLimit-Remaining-Hour'] !== undefined ||
        r.headers['RateLimit-Remaining'] !== undefined,
    });
    rateLimitHeaderPresent.add(hasRateLimitHeaders);

    if (res.status === 429) {
      rateLimitHits.add(1);

      check(res, {
        '429 has error message': (r) => {
          try {
            const body = JSON.parse(r.body);
            return (
              (typeof body.message === 'string' && body.message.toLowerCase().includes('rate limit')) ||
              (typeof body.error === 'string' && body.error.toLowerCase().includes('rate limit'))
            );
          } catch (_) {
            // Kong may return non-JSON for rate limit errors
            return typeof r.body === 'string' && r.body.toLowerCase().includes('rate limit');
          }
        },
        '429 has Retry-After header': (r) =>
          r.headers['Retry-After'] !== undefined || r.headers['X-RateLimit-Reset-Minute'] !== undefined,
      });
    } else if (res.status >= 200 && res.status < 300) {
      // Legitimate traffic that was not rate limited — OK
    } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      // Other 4xx (e.g. 401 auth) is expected with fake consumer keys
    } else if (res.status >= 500) {
      rateLimitMissed.add(1);
    }
  });

  // No sleep — we want to saturate the rate limiter
}

function runAuthRateLimitTest() {
  group('auth_rate_limit', () => {
    // Hammer the login endpoint (tight 20 req/min limit)
    const payload = JSON.stringify({
      email: 'nonexistent@test.com',
      password: 'WrongPassword123!',
    });

    const res = http.post(`${GATEWAY_URL}/v1/auth/login`, payload, {
      headers: DEFAULT_HEADERS,
      tags: { name: 'auth_rate_limit_login' },
    });

    if (res.status === 429) {
      authRateLimitHits.add(1);

      check(res, {
        'auth 429 has error': (r) => r.body.length > 0,
      });
    }

    check(res, {
      'auth endpoint responds (200, 400, 401, or 429)': (r) =>
        r.status === 200 || r.status === 400 || r.status === 401 || r.status === 429,
    });
  });
}

function runRecoveryTest() {
  group('rate_limit_recovery', () => {
    const res = http.get(`${GATEWAY_URL}/health`, {
      headers: DEFAULT_HEADERS,
      tags: { name: 'rate_limit_recovery_check' },
    });

    const recovered = check(res, {
      'recovery traffic succeeds': (r) => r.status === 200,
    });

    rateLimitResumed.add(recovered);
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log(`Rate limiting validation complete against ${data.gatewayUrl}`);
  if (!data.gatewayReachable) {
    console.warn('NOTE: Tests ran against backend directly — Kong rate limiting not validated.');
  }
}

export function handleSummary(data) {
  const limitHits = data.metrics['rate_limit_429_total']?.values?.count ?? 0;
  const authLimitHits = data.metrics['auth_rate_limit_429_total']?.values?.count ?? 0;
  const headerPresentRate = data.metrics['rate_limit_header_present']?.values?.rate ?? 0;
  const recoveryRate = data.metrics['rate_limit_resumed_after_window']?.values?.rate ?? 0;

  console.log('\n======= RATE LIMITING TEST SUMMARY =======');
  console.log(`Rate limit 429s hit:      ${limitHits}  (expected >100)`);
  console.log(`Auth rate limit 429s:     ${authLimitHits}`);
  console.log(`Rate limit headers:       ${(headerPresentRate * 100).toFixed(1)}%  (expected >90%)`);
  console.log(`Recovery success rate:    ${(recoveryRate * 100).toFixed(1)}%  (expected >80%)`);
  console.log('==========================================\n');

  const passed = limitHits > 100 && headerPresentRate > 0.9;
  console.log(`Rate limiting enforcement: ${passed ? 'PASS' : 'FAIL'}`);

  return {
    'load-tests/reports/rate-limiting-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
