/**
 * Load Test: KYC Verification Throughput Under Load
 *
 * Tests the KYC session lifecycle endpoints under concurrent load.
 * Because KYC involves multipart file uploads (documents, selfies),
 * this test focuses on the text-based endpoints:
 *   - POST /v1/kyc/sessions          (session creation)
 *   - GET  /v1/kyc/sessions/current  (session state check)
 *   - POST /v1/kyc/sessions/:id/submit (final submission)
 *
 * File upload endpoints are validated separately with synthetic payloads.
 *
 * SLO: KYC submit p95 < 3,000ms, error rate < 5%
 *
 * Usage:
 *   k6 run load-tests/k6/scenarios/kyc-throughput.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { login, authHeaders } from '../helpers/auth.js';
import { BASE_URL, randomItem } from '../helpers/utils.js';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const kycSessionCreateDuration = new Trend('kyc_session_create_ms', true);
const kycSubmitDuration = new Trend('kyc_submit_ms', true);
const kycDocUploadDuration = new Trend('kyc_doc_upload_ms', true);
const kycErrors = new Counter('kyc_errors_total');
const kycSubmitSuccessRate = new Rate('kyc_submit_success_rate');

// ─── Test configuration ───────────────────────────────────────────────────────
// KYC is a more complex flow — realistic throughput is lower than transactions.
// We target enough concurrency to identify bottlenecks in the submission path.
export const options = {
  scenarios: {
    kyc_throughput: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Warm-up: 50 VUs for 1 minute
        { duration: '1m', target: 50 },
        // Scale: ramp to 200 VUs
        { duration: '2m', target: 200 },
        // Peak: hold 500 VUs for 5 minutes
        { duration: '5m', target: 500 },
        // Extended peak: hold 500 VUs for 2 more minutes
        { duration: '2m', target: 500 },
        // Cool-down
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    kyc_session_poll: {
      // Simulates clients polling session status (lower rate)
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '11m',
      preAllocatedVUs: 50,
      maxVUs: 150,
    },
  },

  thresholds: {
    // KYC session creation should be fast
    kyc_session_create_ms: [
      { threshold: 'p(95)<500', abortOnFail: false },
    ],
    // KYC submit p95 < 3,000ms (SLO from HIT-80)
    kyc_submit_ms: [
      { threshold: 'p(95)<3000', abortOnFail: false },
      { threshold: 'p(99)<8000', abortOnFail: false },
    ],
    // Document upload p95 < 2,000ms
    kyc_doc_upload_ms: [
      { threshold: 'p(95)<2000', abortOnFail: false },
    ],
    // KYC has slightly relaxed error rate (external provider dependency)
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
    kyc_submit_success_rate: [{ threshold: 'rate>0.95', abortOnFail: false }],
  },

  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// ─── Test users ───────────────────────────────────────────────────────────────
const TEST_USERS = [
  { email: __ENV.TEST_USER_EMAIL || 'loadtest+1@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
  { email: __ENV.TEST_USER_EMAIL_2 || 'loadtest+2@afrisend.test', password: __ENV.TEST_USER_PASSWORD || 'LoadTest#2024!' },
];

// Synthetic 1x1 pixel JPEG (minimal valid JPEG header) for document upload tests
// This avoids needing real file fixtures in CI while still testing multipart handling
const SYNTHETIC_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xfb, 0xd2, 0x8a, 0x28, 0x03, 0xff, 0xd9,
]);

// Per-VU state
let vuToken = null;

export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }
  return { baseUrl: BASE_URL };
}

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME;

  if (scenario === 'kyc_session_poll') {
    runSessionPoll();
    return;
  }

  // Lazy-init token
  if (!vuToken) {
    const user = randomItem(TEST_USERS);
    try {
      vuToken = login(user.email, user.password);
    } catch (err) {
      kycErrors.add(1);
      sleep(1);
      return;
    }
  }

  runKycFlow();
}

function runSessionPoll() {
  if (!vuToken) return;

  group('kyc_session_poll', () => {
    const res = http.get(`${BASE_URL}/v1/kyc/sessions/current`, {
      headers: authHeaders(vuToken),
      tags: { name: 'kyc_poll_session' },
    });

    check(res, {
      'kyc poll 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.2);
}

function runKycFlow() {
  let sessionId = null;

  // Step 1: Create KYC session
  group('kyc_create_session', () => {
    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/v1/kyc/sessions`, null, {
      headers: authHeaders(vuToken),
      tags: { name: 'kyc_create_session' },
    });
    const elapsed = Date.now() - startTime;

    kycSessionCreateDuration.add(elapsed);

    const success = check(res, {
      'kyc session 200': (r) => r.status === 200,
      'kyc session has id': (r) => {
        try {
          return Boolean(JSON.parse(r.body).data?.sessionId);
        } catch (_) {
          return false;
        }
      },
      'kyc session create < 500ms': () => elapsed < 500,
    });

    if (success) {
      try {
        sessionId = JSON.parse(res.body).data.sessionId;
      } catch (_) {
        kycErrors.add(1);
      }
    } else {
      kycErrors.add(1);
      if (res.status === 401) vuToken = null;
    }
  });

  if (!sessionId) {
    sleep(0.5);
    return;
  }

  sleep(0.1);

  // Step 2: Upload ID document (front)
  group('kyc_upload_document', () => {
    const formData = {
      document: http.file(SYNTHETIC_JPEG, 'id_front.jpg', 'image/jpeg'),
      documentType: 'national_id',
      side: 'front',
    };

    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/v1/kyc/sessions/${sessionId}/documents`,
      formData,
      {
        headers: { Authorization: `Bearer ${vuToken}` },
        tags: { name: 'kyc_upload_doc' },
      }
    );
    const elapsed = Date.now() - startTime;

    kycDocUploadDuration.add(elapsed);

    check(res, {
      'kyc doc upload 200': (r) => r.status === 200,
      'kyc doc upload < 2000ms': () => elapsed < 2000,
    });

    if (res.status !== 200) kycErrors.add(1);
  });

  sleep(0.1);

  // Step 3: Submit session
  group('kyc_submit_session', () => {
    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/v1/kyc/sessions/${sessionId}/submit`,
      null,
      {
        headers: authHeaders(vuToken),
        tags: { name: 'kyc_submit' },
      }
    );
    const elapsed = Date.now() - startTime;

    kycSubmitDuration.add(elapsed);

    const success = check(res, {
      'kyc submit 200': (r) => r.status === 200,
      'kyc submit < 3000ms (SLO p95)': () => elapsed < 3000,
    });

    kycSubmitSuccessRate.add(success);

    if (!success) {
      kycErrors.add(1);
      if (res.status === 401) vuToken = null;
    }
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log(`KYC throughput test complete against ${data.baseUrl}`);
}

export function handleSummary(data) {
  const createP95 = data.metrics['kyc_session_create_ms']?.values?.['p(95)'] ?? 'N/A';
  const submitP95 = data.metrics['kyc_submit_ms']?.values?.['p(95)'] ?? 'N/A';
  const submitP99 = data.metrics['kyc_submit_ms']?.values?.['p(99)'] ?? 'N/A';
  const uploadP95 = data.metrics['kyc_doc_upload_ms']?.values?.['p(95)'] ?? 'N/A';
  const errorCount = data.metrics['kyc_errors_total']?.values?.count ?? 0;
  const successRate = data.metrics['kyc_submit_success_rate']?.values?.rate ?? 0;

  console.log('\n======= KYC THROUGHPUT TEST SUMMARY =======');
  console.log(`Session create p95: ${createP95}ms  (SLO: <500ms)`);
  console.log(`Submit p95:         ${submitP95}ms  (SLO: <3000ms)`);
  console.log(`Submit p99:         ${submitP99}ms  (SLO: <8000ms)`);
  console.log(`Doc upload p95:     ${uploadP95}ms  (SLO: <2000ms)`);
  console.log(`Total KYC errors:   ${errorCount}`);
  console.log(`Submit success:     ${(successRate * 100).toFixed(2)}%  (SLO: >95%)`);
  console.log('===========================================\n');

  return {
    'load-tests/reports/kyc-throughput-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
