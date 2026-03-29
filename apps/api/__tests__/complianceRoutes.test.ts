/**
 * Integration tests for compliance routes in apps/api (ts-jest suite).
 *
 * Tests the full HTTP → service → response cycle for:
 *   POST /v1/compliance/check              — pre-transaction compliance check
 *   GET  /v1/compliance/limits/:userId     — current usage and limits
 *   POST /v1/compliance/flag/:transactionId — manual flag for review
 *
 * Uses the legacy requireAuth (sandbox bearer token) to keep test setup simple.
 * CI-safe: no external API calls.
 */

import request from 'supertest';
import express from 'express';
import { createComplianceRouter } from '../src/routes/compliance';
import { DefaultComplianceService, ComplianceResult } from '../src/services/complianceService';
import { requireAuth } from '../src/middleware/requireAuth';

// Build a minimal app that mounts the compliance router with sandbox auth
function buildApp() {
  const app = express();
  app.use(express.json());
  const complianceService = new DefaultComplianceService();
  app.use('/v1/compliance', requireAuth, createComplianceRouter(complianceService));
  return app;
}

const AUTH_HEADER = 'Bearer test-token-abc';

const VALID_BODY = {
  transactionId: 'tx-routes-001',
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
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result).toBe(ComplianceResult.Approved);
    expect(typeof res.body.data.checkId).toBe('string');
    expect(res.body.data.checks).toHaveLength(3);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 400 when transactionId is missing', async () => {
    const { transactionId: _t, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is not a number', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_BODY, amount: 'not-a-number' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_BODY, amount: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when currency is missing', async () => {
    const { currency: _c, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when senderName is missing', async () => {
    const { senderName: _s, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when recipientName is missing', async () => {
    const { recipientName: _r, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when kycTier is missing', async () => {
    const { kycTier: _k, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns blocked and MONTHLY_LIMIT_EXCEEDED for tier-1 user over $500', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_BODY, amount: 501, kycTier: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(ComplianceResult.Blocked);
    expect(res.body.data.errorCode).toBe('MONTHLY_LIMIT_EXCEEDED');
  });

  it('returns blocked for sanctioned sender', async () => {
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_BODY, senderName: 'BLOCKED ENTITY TEST' });

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe(ComplianceResult.Blocked);
  });

  it('accepts optional corridorId', async () => {
    const { corridorId: _c, ...bodyWithoutCorridor } = VALID_BODY;
    const res = await request(app)
      .post('/v1/compliance/check')
      .set('Authorization', AUTH_HEADER)
      .send(bodyWithoutCorridor);

    expect(res.status).toBe(200);
  });
});

// ─── GET /v1/compliance/limits/:userId ───────────────────────────────────────

describe('GET /v1/compliance/limits/:userId', () => {
  const app = buildApp();

  it('returns 200 with limits for a fresh user', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/fresh-user-api')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.monthlyLimit).toBe('number');
    expect(res.body.data.monthlyUsed).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/any-user');

    expect(res.status).toBe(401);
  });

  it('defaults kycTier to 1 when not provided', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/user-default-tier')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.monthlyLimit).toBe(500);
    expect(res.body.data.kycTier).toBe(1);
  });

  it('accepts kycTier as query param', async () => {
    const res = await request(app)
      .get('/v1/compliance/limits/user-tier2?kycTier=2')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.monthlyLimit).toBe(3000);
    expect(res.body.data.kycTier).toBe(2);
  });
});

// ─── POST /v1/compliance/flag/:transactionId ─────────────────────────────────

describe('POST /v1/compliance/flag/:transactionId', () => {
  const app = buildApp();

  it('returns 200 with flag record', async () => {
    const res = await request(app)
      .post('/v1/compliance/flag/tx-api-flag-001')
      .set('Authorization', AUTH_HEADER)
      .send({ reason: 'Suspicious pattern' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-api-flag-001');
    expect(typeof res.body.data.flagId).toBe('string');
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
});
