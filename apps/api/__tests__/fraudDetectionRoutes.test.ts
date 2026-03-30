/**
 * Unit tests for fraud detection routes (apps/api ts-jest suite).
 *
 * Tests the full HTTP → service → response cycle for:
 *   POST /fraud/assess                   — pre-authorization fraud assessment
 *   GET  /fraud/decisions/:transactionId — get stored fraud decision
 *   GET  /fraud/devices/:deviceId        — get device trust info
 *
 * Uses createRequireAuth + real JwtService so that the JWT auth-guard branch
 * is fully exercised — including token verification failures.
 * CI-safe: no external API calls.
 */

import request from 'supertest';
import express, { ErrorRequestHandler } from 'express';
import { createFraudDetectionRouter } from '../src/routes/fraudDetection';
import {
  DefaultFraudDetectionService,
  FraudAction,
  IFraudDetectionService,
} from '../src/services/fraudDetectionService';
import { createRequireAuth } from '../src/middleware/requireAuth';
import { JwtService } from '../src/services/jwtService';

// ─── Test-suite auth setup ────────────────────────────────────────────────────

let jwtService: JwtService;
let validToken: string;

beforeAll(async () => {
  jwtService = new JwtService();
  validToken = await jwtService.signAccessToken({
    userId: 'user-test-001',
    email: 'test@afrisend.test',
  });
});

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp(fraudService?: IFraudDetectionService) {
  const app = express();
  app.use(express.json());
  const service = fraudService ?? new DefaultFraudDetectionService();
  app.use('/fraud', createRequireAuth(jwtService), createFraudDetectionRouter(service));

  // Error handler so catch-path errors become 500 responses in tests
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    res.status(500).json({ success: false, error: (err as Error).message ?? 'Internal Server Error' });
  };
  app.use(errorHandler);

  return app;
}

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
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  it('returns 200 with a fraud assessment result', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
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

  it('returns 401 for an invalid/tampered JWT', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .send(VALID_ASSESS_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a JWT signed with a different key', async () => {
    const otherService = new JwtService();
    const foreignToken = await otherService.signAccessToken({
      userId: 'attacker',
      email: 'attacker@evil.test',
    });

    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${foreignToken}`)
      .send(VALID_ASSESS_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 400 when transactionId is missing', async () => {
    const { transactionId: _t, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const { amount: _a, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-zero', amount: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-neg', amount: -50 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when currency is missing', async () => {
    const { currency: _c, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceId is missing', async () => {
    const { deviceId: _d, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('returns 400 when ipAddress is missing', async () => {
    const { ipAddress: _i, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('defaults hour to current UTC hour when not provided', async () => {
    const { hour: _h, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...body, transactionId: 'tx-no-hour' });

    expect(res.status).toBe(200);
    expect(res.body.data.transactionId).toBe('tx-no-hour');
  });

  it('accepts optional fields (recipientId, corridorId, userAgent) as absent', async () => {
    const { recipientId: _r, corridorId: _c, userAgent: _u, ...body } = VALID_ASSESS_BODY;
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...body, transactionId: 'tx-optional' });

    expect(res.status).toBe(200);
  });

  it('result action is one of the valid FraudAction values', async () => {
    const res = await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-action' });

    const validActions = Object.values(FraudAction);
    expect(validActions).toContain(res.body.data.action);
  });

  it('propagates service errors to the error handler (catch path)', async () => {
    const brokenService: IFraudDetectionService = {
      assess: jest.fn().mockRejectedValue(new Error('assess exploded')),
      getDecision: jest.fn(),
      getDeviceTrust: jest.fn(),
    };
    const brokenApp = buildApp(brokenService);

    const res = await request(brokenApp)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send(VALID_ASSESS_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('assess exploded');
  });
});

// ─── GET /fraud/decisions/:transactionId ─────────────────────────────────────

describe('GET /fraud/decisions/:transactionId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  it('returns 404 for unknown transactionId', async () => {
    const res = await request(app)
      .get('/fraud/decisions/tx-does-not-exist')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with stored decision after assess', async () => {
    await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-get-decision' });

    const res = await request(app)
      .get('/fraud/decisions/tx-get-decision')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-get-decision');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/fraud/decisions/tx-any');

    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid JWT', async () => {
    const res = await request(app)
      .get('/fraud/decisions/tx-any')
      .set('Authorization', 'Bearer bad.token');

    expect(res.status).toBe(401);
  });

  it('propagates service errors to the error handler (catch path)', async () => {
    const brokenService: IFraudDetectionService = {
      assess: jest.fn(),
      getDecision: jest.fn().mockRejectedValue(new Error('getDecision exploded')),
      getDeviceTrust: jest.fn(),
    };
    const brokenApp = buildApp(brokenService);

    const res = await request(brokenApp)
      .get('/fraud/decisions/tx-any')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('getDecision exploded');
  });
});

// ─── GET /fraud/devices/:deviceId ────────────────────────────────────────────

describe('GET /fraud/devices/:deviceId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  it('returns 404 for unknown deviceId', async () => {
    const res = await request(app)
      .get('/fraud/devices/unknown-device')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with device trust info after a transaction', async () => {
    await request(app)
      .post('/fraud/assess')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ ...VALID_ASSESS_BODY, transactionId: 'tx-device-trust', deviceId: 'dev-known' });

    const res = await request(app)
      .get('/fraud/devices/dev-known')
      .set('Authorization', `Bearer ${validToken}`);

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

  it('returns 401 for an invalid JWT', async () => {
    const res = await request(app)
      .get('/fraud/devices/any-device')
      .set('Authorization', 'Bearer not.a.jwt');

    expect(res.status).toBe(401);
  });

  it('propagates service errors to the error handler (catch path)', async () => {
    const brokenService: IFraudDetectionService = {
      assess: jest.fn(),
      getDecision: jest.fn(),
      getDeviceTrust: jest.fn().mockRejectedValue(new Error('getDeviceTrust exploded')),
    };
    const brokenApp = buildApp(brokenService);

    const res = await request(brokenApp)
      .get('/fraud/devices/any-device')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('getDeviceTrust exploded');
  });
});
