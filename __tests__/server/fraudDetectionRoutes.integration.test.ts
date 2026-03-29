/**
 * Integration tests for fraud detection routes.
 *
 * Tests POST /fraud/assess and GET /fraud/decisions/:transactionId
 * and GET /fraud/devices/:deviceId.
 */

import request from 'supertest';
import express from 'express';
import { createFraudDetectionRouter } from '@/server/routes/fraudDetection';
import {
  DefaultFraudDetectionService,
  FraudAction,
} from '@/server/services/fraudDetectionService';
import { requireAuth } from '@/server/middleware/requireAuth';
import type { Application } from 'express';

// ─── App factory ──────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());

  // Inject a fake userId so requireAuth passes
  app.use((req, _res, next) => {
    (req as any).userId = 'user-test-001';
    next();
  });

  const fraudService = new DefaultFraudDetectionService();
  app.use('/v1/fraud', createFraudDetectionRouter(fraudService));
  return app;
}

// ─── POST /v1/fraud/assess ────────────────────────────────────────────────────

describe('POST /v1/fraud/assess', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
  });

  const validBody = {
    transactionId: 'tx-route-001',
    amount: 100,
    currency: 'USD',
    recipientId: 'rec-001',
    corridorId: 'cor-ng',
    deviceId: 'device-route-001',
    ipAddress: '192.168.1.100',
    userAgent: 'TestAgent/1.0',
    hour: 10,
  };

  it('returns 200 with assessment on valid input', async () => {
    const res = await request(app).post('/v1/fraud/assess').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assessmentId).toBeTruthy();
    expect(res.body.data.transactionId).toBe('tx-route-001');
    expect(res.body.data.riskScore).toBeGreaterThanOrEqual(0);
    expect(Object.values(FraudAction)).toContain(res.body.data.action);
  });

  it('returns 400 when transactionId is missing', async () => {
    const { transactionId: _, ...body } = validBody;
    const res = await request(app).post('/v1/fraud/assess').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is not a positive number', async () => {
    const res = await request(app).post('/v1/fraud/assess').send({ ...validBody, amount: -50 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when currency is missing', async () => {
    const { currency: _, ...body } = validBody;
    const res = await request(app).post('/v1/fraud/assess').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when deviceId is missing', async () => {
    const { deviceId: _, ...body } = validBody;
    const res = await request(app).post('/v1/fraud/assess').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const { ipAddress: _, ...body } = validBody;
    const res = await request(app).post('/v1/fraud/assess').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /v1/fraud/decisions/:transactionId ───────────────────────────────────

describe('GET /v1/fraud/decisions/:transactionId', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
  });

  it('returns 200 with decision after assessment', async () => {
    // First assess
    await request(app).post('/v1/fraud/assess').send({
      transactionId: 'tx-lookup-001',
      amount: 50,
      currency: 'USD',
      recipientId: 'rec-001',
      corridorId: 'cor-ng',
      deviceId: 'device-lookup',
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      hour: 12,
    });

    const res = await request(app).get('/v1/fraud/decisions/tx-lookup-001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-lookup-001');
  });

  it('returns 404 for unknown transactionId', async () => {
    const res = await request(app).get('/v1/fraud/decisions/tx-nonexistent-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /v1/fraud/devices/:deviceId ─────────────────────────────────────────

describe('GET /v1/fraud/devices/:deviceId', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
  });

  it('returns 200 with device trust info after transaction', async () => {
    await request(app).post('/v1/fraud/assess').send({
      transactionId: 'tx-dev-001',
      amount: 75,
      currency: 'USD',
      recipientId: 'rec-001',
      corridorId: 'cor-ng',
      deviceId: 'device-test-trust',
      ipAddress: '172.16.0.1',
      userAgent: 'TestAgent/1.0',
      hour: 9,
    });

    const res = await request(app).get('/v1/fraud/devices/device-test-trust');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toBe('device-test-trust');
    expect(typeof res.body.data.trustScore).toBe('number');
  });

  it('returns 404 for unknown deviceId', async () => {
    const res = await request(app).get('/v1/fraud/devices/unknown-device-xyz-999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
