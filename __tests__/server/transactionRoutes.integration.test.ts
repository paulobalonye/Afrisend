/**
 * Transaction routes integration tests — real DefaultTransactionService.
 *
 * Tests the full HTTP → service → response cycle for:
 *   POST   /v1/transactions         — initiate send
 *   GET    /v1/transactions/:id     — get transaction status
 *   GET    /v1/transactions         — list user transactions (paginated)
 *   POST   /v1/transactions/:id/cancel — cancel if still pending
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
import { DefaultTransactionService, TransactionStatus } from '@/server/services/transactionService';

function buildApp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createApp({
    otpService: new DefaultOtpService(),
    authService: new DefaultAuthService(),
    kycService: new DefaultKycService(),
    remittanceService: new DefaultRemittanceService(),
    userService: new DefaultUserService(),
    transactionService: new DefaultTransactionService(),
  } as any);
}

const AUTH_TOKEN = 'tx-test-token';
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_TX_BODY = {
  idempotencyKey: 'idem-tx-001',
  amount: 100,
  currency: 'USDC',
  targetAmount: 150000,
  targetCurrency: 'NGN',
  fxRate: 1500,
  corridorId: 'cor-ng',
  quoteId: 'qt-tx-1',
};

// ─── POST /v1/transactions ───────────────────────────────────────────────────

describe('POST /v1/transactions (integration)', () => {
  const app = buildApp();

  it('initiates a transaction and returns 201 with tx object', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_TX_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.idempotencyKey).toBe('idem-tx-001');
    expect(res.body.data.amount).toBe(100);
    expect(res.body.data.currency).toBe('USDC');
    expect(res.body.data.targetAmount).toBe(150000);
    expect(res.body.data.targetCurrency).toBe('NGN');
    expect(res.body.data.fxRate).toBe(1500);
    expect(res.body.data.status).toBe(TransactionStatus.Pending);
    expect(res.body.data.retryCount).toBe(0);
  });

  it('each transaction gets a unique id', async () => {
    const r1 = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, idempotencyKey: 'idem-unique-a' });
    const r2 = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, idempotencyKey: 'idem-unique-b' });

    expect(r1.body.data.id).not.toBe(r2.body.data.id);
  });

  it('accepts optional recipientId, payoutRail, quoteId, corridorId', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({
        ...VALID_TX_BODY,
        idempotencyKey: 'idem-full-fields',
        recipientId: 'rec-abc',
        payoutRail: 'yellowcard',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.payoutRail).toBe('yellowcard');
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .send(VALID_TX_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 400 when idempotencyKey is missing', async () => {
    const { idempotencyKey: _i, ...body } = VALID_TX_BODY;
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/i);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, amount: -10 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when currency is missing', async () => {
    const { currency: _c, ...body } = VALID_TX_BODY;
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/currency/i);
  });

  it('returns 400 when targetAmount is missing', async () => {
    const { targetAmount: _t, ...body } = VALID_TX_BODY;
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetAmount/i);
  });

  it('returns 400 when targetCurrency is missing', async () => {
    const { targetCurrency: _t, ...body } = VALID_TX_BODY;
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetCurrency/i);
  });

  it('returns 400 when fxRate is zero', async () => {
    const res = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, fxRate: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fxRate/i);
  });
});

// ─── GET /v1/transactions/:id ────────────────────────────────────────────────

describe('GET /v1/transactions/:id (integration)', () => {
  const app = buildApp();

  it('retrieves transaction by id', async () => {
    // Create a transaction first
    const createRes = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, idempotencyKey: 'idem-get-test' });

    const txId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/v1/transactions/${txId}`)
      .set('Authorization', AUTH_HEADER);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.id).toBe(txId);
    expect(getRes.body.data.status).toBe(TransactionStatus.Pending);
  });

  it('returns 404 for nonexistent transaction id', async () => {
    const res = await request(app)
      .get('/v1/transactions/nonexistent-id-xyz')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/v1/transactions/some-id');
    expect(res.status).toBe(401);
  });
});

// ─── GET /v1/transactions ────────────────────────────────────────────────────

describe('GET /v1/transactions (integration)', () => {
  const app = buildApp();

  it('returns empty list for user with no transactions', async () => {
    const res = await request(app)
      .get('/v1/transactions')
      .set('Authorization', 'Bearer fresh-user-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(10);
  });

  it('returns paginated list with created transactions', async () => {
    // Create 3 transactions
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/v1/transactions')
        .set('Authorization', AUTH_HEADER)
        .send({ ...VALID_TX_BODY, idempotencyKey: `idem-list-${i}` });
    }

    const res = await request(app)
      .get('/v1/transactions')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(typeof res.body.meta.total).toBe('number');
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('respects pagination parameters', async () => {
    const res = await request(app)
      .get('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/v1/transactions');
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/transactions/:id/cancel ────────────────────────────────────────

describe('POST /v1/transactions/:id/cancel (integration)', () => {
  const app = buildApp();

  it('cancels a pending transaction', async () => {
    const createRes = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, idempotencyKey: 'idem-cancel-test' });

    const txId = createRes.body.data.id;

    const cancelRes = await request(app)
      .post(`/v1/transactions/${txId}/cancel`)
      .set('Authorization', AUTH_HEADER);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.data.status).toBe(TransactionStatus.Cancelled);
  });

  it('returns 409 when cancelling an already-cancelled transaction', async () => {
    const createRes = await request(app)
      .post('/v1/transactions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_TX_BODY, idempotencyKey: 'idem-double-cancel' });

    const txId = createRes.body.data.id;

    // First cancel
    await request(app)
      .post(`/v1/transactions/${txId}/cancel`)
      .set('Authorization', AUTH_HEADER);

    // Second cancel should fail
    const secondCancel = await request(app)
      .post(`/v1/transactions/${txId}/cancel`)
      .set('Authorization', AUTH_HEADER);

    expect(secondCancel.status).toBe(409);
    expect(secondCancel.body.success).toBe(false);
  });

  it('returns 404 for nonexistent transaction', async () => {
    const res = await request(app)
      .post('/v1/transactions/nonexistent-cancel-id/cancel')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/v1/transactions/some-id/cancel');

    expect(res.status).toBe(401);
  });
});
