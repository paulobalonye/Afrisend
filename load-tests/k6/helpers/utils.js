/**
 * Shared utilities, constants, and threshold definitions for k6 load tests.
 */

// ─── Environment config ───────────────────────────────────────────────────────
// Override via K6_BASE_URL environment variable when running against staging/prod.
export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// How long to pause after hitting the auth rate limiter (ms)
export const AUTH_RATE_LIMIT_PAUSE_MS = 500;

// ─── Performance SLO thresholds ──────────────────────────────────────────────
// Derived from HIT-80 requirements:
//   transaction initiation <500ms p95
//   FX quote              <200ms p99
//   KYC submit            <3s p95

export const TRANSACTION_THRESHOLDS = {
  // HTTP error rate < 1%
  'http_req_failed{scenario:transaction_load}': [{ threshold: 'rate<0.01', abortOnFail: false }],
  // p95 response time < 500ms
  'http_req_duration{scenario:transaction_load,name:transaction_initiate}': [
    { threshold: 'p(95)<500', abortOnFail: false },
  ],
  // p99 response time < 1500ms (extended ceiling for burst)
  'http_req_duration{scenario:transaction_load,name:transaction_initiate}': [
    { threshold: 'p(99)<1500', abortOnFail: false },
  ],
};

export const FX_THRESHOLDS = {
  'http_req_failed{scenario:fx_quote_load}': [{ threshold: 'rate<0.01', abortOnFail: false }],
  // FX quote p99 < 200ms
  'http_req_duration{scenario:fx_quote_load,name:fx_create_quote}': [
    { threshold: 'p(99)<200', abortOnFail: false },
  ],
};

export const KYC_THRESHOLDS = {
  'http_req_failed{scenario:kyc_throughput}': [{ threshold: 'rate<0.05', abortOnFail: false }],
  // KYC submit p95 < 3s
  'http_req_duration{scenario:kyc_throughput,name:kyc_submit}': [
    { threshold: 'p(95)<3000', abortOnFail: false },
  ],
};

export const RATE_LIMIT_THRESHOLDS = {
  // Expect 429s — success means we ARE hitting the limiter as intended
  'checks{scenario:rate_limit_validation}': [{ threshold: 'rate>0.99', abortOnFail: false }],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 for idempotency keys.
 * k6 doesn't provide crypto.randomUUID, so we use a simple substitution.
 */
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random amount between min and max (inclusive), rounded to 2dp.
 */
export function randomAmount(min = 10, max = 500) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Encode a plain object to URL search params string.
 * @param {Record<string, string|number>} params
 * @returns {string}
 */
export function toQueryString(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// Supported corridors for random selection
export const CORRIDORS = [
  { from: 'USD', to: 'NGN' },
  { from: 'GBP', to: 'KES' },
  { from: 'EUR', to: 'GHS' },
  { from: 'USD', to: 'ZAR' },
  { from: 'USD', to: 'KES' },
];
