/**
 * Unit tests for fraud detection routes (apps/api ts-jest suite).
 *
 * Tests the full HTTP → service → response cycle for:
 *   POST /fraud/assess                   — pre-authorization fraud assessment
 *   GET  /fraud/decisions/:transactionId — get stored fraud decision
 *   GET  /fraud/devices/:deviceId        — get device trust info
 *
 * Uses the sandbox requireAuth middleware to keep test setup simple.
 * CI-safe: no external API calls.
 */

import request from 'supertest';
import express from 'express';
import { createFraudDetectionRouter } from '../src/routes/fraudDetection';
import { DefaultFraudDetectionService, FraudAction } from '../src/services/fraudDetectionService';
import { requireAuth } from '../src/middleware/requireAuth';

function buildApp() {
  const app = express();
  app.use(express.json());
  const fraudService = new DefaultFraudDetectionService();
  app.use('/fraud', requireAuth, createFraudDetectionRouter(fraudService));
  return app;
}

const AUTH_HEADER = 'Bearer test-token-abc';

const VALID_ASSESS_BODY = {
  transactionId: 'tx-route-001',
  amount: 100,
  currency: 'USD',
  deviceId: 'device-test-001',
  ipAddress: '1.2.3.4',
  recipientId: 'recip-001',
  corridorId: 'cor-ng',
  userAgent: 'TestBrowser/1.0',
  hour: 12,
};

// ─── POST /fraud/assess ───────────────────────────────────────────────────────

describe('POST /fraud/assess', () => {
  const app = buildApp();

  it('returns 200 with a fraud assessment result', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_ASSESS_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-route-001');
    expect(typeof res.body.data.riskScore).toBe('number');
    expect(typeof res.body.data.assessmentId).toBe('string');
    expect(res.body.data.checks).toHaveLength(3);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .send(VALID_ASSESS_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 400 when transactionId is missing', async () => {
    const { transactionId: _t, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const { amount: _a, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-zero', amount: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-neg', amount: -50 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when currency is missing', async () => {
    const { currency: _c, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceId is missing', async () => {
    const { deviceId: _d, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const { ipAddress: _i, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('defaults hour to current UTC hour when not provided', async () => {
    const { hour: _h, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...body, transactionId: 'tx-no-hour' });

    expect(res.status).toBe(200);
    expect(res.body.data.transactionId).toBe('tx-no-hour');
  });

  it('accepts optional fields (recipientId, corridorId, userAgent) as absent', async () => {
    const { recipientId: _r, corridorId: _c, userAgent: _u, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...body, transactionId: 'tx-optional' });

    expect(res.status).toBe(200);
  });

  it('result action is one of the valid FraudAction values', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-action' });

    const validActions = Object.values(FraudAction);
    expect(validActions).toContain(res.body.data.action);
  });
});

// ─── GET /fraud/decisions/:transactionId ─────────────────────────────────────

describe('GET /fraud/decisions/:transactionId', () => {
  const app = buildApp();

  it('returns 404 for unknown transactionId', async () => {
    const res = await request(app)
      .get('/fraud/decisions/tx-does-not-exist')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 200 with stored decision after assess', async () => {
    // First create a decision
    await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-get-decision' });

    const res = await request(app)
      .get('/fraud/decisions/tx-get-decision')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-get-decision');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/fraud/decisions/tx-any');

    expect(res.status).toBe(401);
  });
});

// ─── GET /fraud/devices/:deviceId ────────────────────────────────────────────

describe('GET /fraud/devices/:deviceId', () => {
  const app = buildApp();

  it('returns 404 for unknown deviceId', async () => {
    const res = await request(app)
      .get('/fraud/devices/unknown-device')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 200 with device trust info after a transaction', async () => {
    // First create a transaction with that device
    await request(app)
      .post('/fraud/assess')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-device-trust', deviceId: 'dev-known' });

    const res = await request(app)
      .get('/fraud/devices/dev-known')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toBe('dev-known');
    expect(typeof res.body.data.trustScore).toBe('number');
    expect(typeof res.body.data.transactionCount).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/fraud/devices/any-device');

    expect(res.status).toBe(401);
  });
});
