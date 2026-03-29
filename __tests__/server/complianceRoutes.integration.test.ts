/**
 * Integration tests for compliance routes.
 *
 * Tests the full HTTP → service → response cycle for:
 *   POST /v1/compliance/check              — pre-transaction compliance check
 *   GET  /v1/compliance/limits/:userId     — current usage and limits
 *   POST /v1/compliance/flag/:transactionId — manual flag for review
 *
 * Auth middleware is active (requires Bearer token).
 * CI-safe: no external API calls.
 */

import request from 'supertest';
import { createApp } from '@/server/app';
import { DefaultOtpService } from '@/server/services/otpService';
import { DefaultAuthService } from '@/server/services/authService';
import { DefaultKycService } from '@/server/services/kycService';
import { DefaultRemittanceService } from '@/server/services/remittanceService';
import { DefaultUserService } from '@/server/services/userService';
import { DefaultTransactionService } from '@/server/services/transactionService';
import { DefaultComplianceService, ComplianceResult } from '@/server/services/complianceService';

// buildApp uses only the services required for compliance tests.
// Babel/jest-expo transpiles TS without strict type checking, so omitting
// optional services (jwtService, adminService, etc.) is safe here.
function buildApp() {
  const complianceService = new DefaultComplianceService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createApp({
    otpService: new DefaultOtpService(),
    authService: new DefaultAuthService(),
    kycService: new DefaultKycService(),
    remittanceService: new DefaultRemittanceService(),
    userService: new DefaultUserService(),
    transactionService: new DefaultTransactionService(),
    complianceService,
  } as any);
}

const AUTH_TOKEN = 'compliance-test-token';
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_CHECK_BODY = {
  transactionId: 'tx-integration-001',
  amount: 100,
  currency: 'USD',
  senderName: 'John Doe',
  recipientName: 'Jane Smith',
  corridorId: 'cor-ng',
  kycTier: 2,
};

// ─── POST /v1/compliance/check ────────────────────────────────────────────────

describe('POST /v1/compliance/check', () => {
  const app = buildApp();

  it('returns 200 with approved result for a clean transaction', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_CHECK_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result).toBe(ComplianceResult.Approved);
    expect(typeof res.body.data.checkId).toBe('string');
    expect(typeof res.body.data.riskScore).toBe('number');
    expect(res.body.data.checks).toBeInstanceOf(Array);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .send(VALID_CHECK_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 400 when amount is missing', async () => {
    const { amount: _a, ...bodyWithoutAmount } = VALID_CHECK_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(bodyWithoutAmount);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_CHECK_BODY, amount: -50 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when senderName is missing', async () => {
    const { senderName: _s, ...body } = VALID_CHECK_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when recipientName is missing', async () => {
    const { recipientName: _r, ...body } = VALID_CHECK_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when kycTier is missing', async () => {
    const { kycTier: _k, ...body } = VALID_CHECK_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns blocked result and MONTHLY_LIMIT_EXCEEDED for tier-1 user exceeding $500', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_CHECK_BODY, amount: 501, kycTier: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(ComplianceResult.Blocked);
    expect(res.body.data.errorCode).toBe('MONTHLY_LIMIT_EXCEEDED');
  });

  it('returns blocked result for sanctioned sender name', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_CHECK_BODY, senderName: 'BLOCKED ENTITY TEST' });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(ComplianceResult.Blocked);
  });

  it('uses authenticated userId from token for limit tracking', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_CHECK_BODY);

    expect(res.body.data.userId).toBeTruthy();
  });
});

// ─── GET /v1/compliance/limits/:userId ───────────────────────────────────────

describe('GET /v1/compliance/limits/:userId', () => {
  const app = buildApp();

  it('returns 200 with usage and limits for a user', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/user-fresh')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.monthlyLimit).toBe('number');
    expect(typeof res.body.data.monthlyUsed).toBe('number');
    expect(res.body.data.kycTier).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/user-fresh');

    expect(res.status).toBe(401);
  });

  it('returns zero usage for a new user', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/brand-new-user-xyz')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.monthlyUsed).toBe(0);
  });
});

// ─── POST /v1/compliance/flag/:transactionId ─────────────────────────────────

describe('POST /v1/compliance/flag/:transactionId', () => {
  const app = buildApp();

  it('returns 200 with flag record', async () => {
    const res = await request(app)
      .post('/v1/compliance/flag/tx-to-flag-001')
      .set('Authorization', AUTH_HEADER)
      .send({ reason: 'Suspicious pattern detected' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-to-flag-001');
    expect(typeof res.body.data.flagId).toBe('string');
    expect(res.body.data.reason).toBe('Suspicious pattern detected');
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/v1/compliance/flag/tx-no-reason')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/v1/compliance/flag/tx-unauth')
      .send({ reason: 'test' });

    expect(res.status).toBe(401);
  });

  it('assigns a unique flagId per request', async () => {
    const r1 = await request(app)
      .post('/v1/compliance/flag/tx-flag-a')
      .set('Authorization', AUTH_HEADER)
      .send({ reason: 'reason a' });

    const r2 = await request(app)
      .post('/v1/compliance/flag/tx-flag-b')
      .set('Authorization', AUTH_HEADER)
      .send({ reason: 'reason b' });

    expect(r1.body.data.flagId).not.toBe(r2.body.data.flagId);
  });
});
