/**
 * Auth helper for k6 load tests.
 *
 * Provides token acquisition and caching so each VU only logs in once,
 * reducing noise in auth metrics during the primary test scenarios.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, AUTH_RATE_LIMIT_PAUSE_MS } from './utils.js';

/**
 * Obtain a JWT by calling the password login endpoint.
 * Returns the access token string or throws on failure.
 *
 * @param {string} email
 * @param {string} password
 * @returns {string} accessToken
 */
export function login(email, password) {
  const payload = JSON.stringify({ email, password });
  const res = http.post(`${BASE_URL}/v1/auth/login`, payload, {
    headers: DEFAULT_HEADERS,
    tags: { name: 'auth_login' },
  });

  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'login has access_token': (r) => {
      try {
        return JSON.parse(r.body).data?.accessToken !== undefined;
      } catch (_) {
        return false;
      }
    },
  });

  if (!ok) {
    // Pause briefly to avoid hammering the auth rate limiter
    sleep(AUTH_RATE_LIMIT_PAUSE_MS / 1000);
    throw new Error(`Login failed for ${email}: status=${res.status} body=${res.body}`);
  }

  return JSON.parse(res.body).data.accessToken;
}

/**
 * Build Authorization headers from a pre-obtained token.
 *
 * @param {string} token
 * @returns {Object} headers object
 */
export function authHeaders(token) {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Register a test user and return a JWT.
 * Used to seed VU state during setup() or init phase.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} temporaryToken  — from a completed OTP verify flow
 * @returns {string} accessToken
 */
export function registerAndLogin(email, password, firstName, lastName, temporaryToken) {
  const registerPayload = JSON.stringify({
    temporaryToken,
    firstName,
    lastName,
    email,
    password,
  });

  const regRes = http.post(`${BASE_URL}/v1/auth/register`, registerPayload, {
    headers: DEFAULT_HEADERS,
    tags: { name: 'auth_register' },
  });

  check(regRes, {
    'register 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  return login(email, password);
}
