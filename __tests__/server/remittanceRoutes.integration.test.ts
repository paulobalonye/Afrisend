/**
 * Remittance / Transaction routes integration tests — real DefaultRemittanceService.
 *
 * Tests the full HTTP → service → response cycle for:
 *   - /v1/remittance (corridors, rates, payments, settlement)
 *   - /v1/bank (bank account verification)
 *   - /v1/payment (Flutterwave + YellowCard webhooks)
 *
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

function buildApp() {
  return createApp({
    otpService: new DefaultOtpService(),
    authService: new DefaultAuthService(),
    kycService: new DefaultKycService(),
    remittanceService: new DefaultRemittanceService(),
    userService: new DefaultUserService(),
    transactionService: new DefaultTransactionService(),
  });
}

const VALID_RECIPIENT = {
  name: 'John Doe',
  accountNumber: '0690000031',
  bankCode: '044',
  bankName: 'Access Bank',
};

// ─── GET /v1/remittance/corridors ────────────────────────────────────────────

describe('GET /v1/remittance/corridors (integration)', () => {
  const app = buildApp();

  it('returns list of active corridors', async () => {
    const res = await request(app).get('/v1/remittance/corridors');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('each corridor has required fields', async () => {
    const res = await request(app).get('/v1/remittance/corridors');
    const corridor = res.body.data[0];

    expect(typeof corridor.id).toBe('string');
    expect(corridor.sourceCurrency).toBe('USDC');
    expect(typeof corridor.destinationCurrency).toBe('string');
    expect(typeof corridor.destinationCountry).toBe('string');
    expect(typeof corridor.minAmount).toBe('number');
    expect(typeof corridor.maxAmount).toBe('number');
    expect(corridor.isActive).toBe(true);
  });

  it('includes NG, GH, and KE corridors', async () => {
    const res = await request(app).get('/v1/remittance/corridors');
    const countries = res.body.data.map((c: { destinationCountry: string }) => c.destinationCountry);

    expect(countries).toContain('NG');
    expect(countries).toContain('GH');
    expect(countries).toContain('KE');
  });
});

// ─── GET /v1/remittance/v2/rates ─────────────────────────────────────────────

describe('GET /v1/remittance/v2/rates (integration)', () => {
  const app = buildApp();

  it('returns a rate quote for NGN corridor', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: '100' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.corridorId).toBe('cor-ng');
    expect(res.body.data.sourceCurrency).toBe('USDC');
    expect(res.body.data.destinationCurrency).toBe('NGN');
    expect(res.body.data.sourceAmount).toBe(100);
    expect(res.body.data.destinationAmount).toBe(150000);
    expect(res.body.data.exchangeRate).toBe(1500);
    expect(typeof res.body.data.fee).toBe('number');
    expect(res.body.data.fee).toBeGreaterThan(0);
    expect(typeof res.body.data.quoteId).toBe('string');
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns correct exchange rate for GHS corridor', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-gh', sourceAmount: '50' });

    expect(res.status).toBe(200);
    expect(res.body.data.destinationCurrency).toBe('GHS');
    expect(res.body.data.destinationAmount).toBe(50 * 14);
  });

  it('returns correct exchange rate for KES corridor', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ke', sourceAmount: '200' });

    expect(res.status).toBe(200);
    expect(res.body.data.destinationCurrency).toBe('KES');
    expect(res.body.data.destinationAmount).toBe(200 * 130);
  });

  it('fee is at least $1 for small amounts', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: '5' });

    expect(res.status).toBe(200);
    expect(res.body.data.fee).toBeGreaterThanOrEqual(1);
  });

  it('accepts optional refreshIntervalSeconds', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: '100', refreshIntervalSeconds: '30' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when corridorId is missing', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ sourceAmount: '100' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/corridorId/i);
  });

  it('returns 400 when sourceAmount is missing', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sourceAmount/i);
  });

  it('returns 400 when sourceAmount is not a positive number', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: '-10' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/i);
  });

  it('returns 400 when sourceAmount is zero', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: '0' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceAmount is not numeric', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-ng', sourceAmount: 'abc' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/remittance/payments ────────────────────────────────────────────

describe('POST /v1/remittance/payments (integration)', () => {
  const app = buildApp();

  const VALID_PAYMENT_BODY = {
    idempotencyKey: 'idem-test-001',
    quoteId: 'qt-abc123',
    corridorId: 'cor-ng',
    sourceCurrency: 'USDC',
    sourceAmount: 100,
    recipient: VALID_RECIPIENT,
    senderNote: 'School fees',
  };

  it('initiates payment and returns payment object', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(VALID_PAYMENT_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.idempotencyKey).toBe('idem-test-001');
    expect(res.body.data.corridorId).toBe('cor-ng');
    expect(res.body.data.sourceCurrency).toBe('USDC');
    expect(res.body.data.sourceAmount).toBe(100);
    expect(res.body.data.status).toBe('pending');
    expect(typeof res.body.data.createdAt).toBe('string');
  });

  it('each payment gets a unique id', async () => {
    const r1 = await request(app)
      .post('/v1/remittance/payments')
      .send({ ...VALID_PAYMENT_BODY, idempotencyKey: 'idem-1' });
    const r2 = await request(app)
      .post('/v1/remittance/payments')
      .send({ ...VALID_PAYMENT_BODY, idempotencyKey: 'idem-2' });

    expect(r1.body.data.id).not.toBe(r2.body.data.id);
  });

  it('accepts payment without senderNote', async () => {
    const { senderNote: _s, ...body } = VALID_PAYMENT_BODY;
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(body);

    expect(res.status).toBe(200);
  });

  it('returns 400 when idempotencyKey is missing', async () => {
    const { idempotencyKey: _i, ...body } = VALID_PAYMENT_BODY;
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });

  it('returns 400 when quoteId is missing', async () => {
    const { quoteId: _q, ...body } = VALID_PAYMENT_BODY;
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quoteId/i);
  });

  it('returns 400 when corridorId is missing', async () => {
    const { corridorId: _c, ...body } = VALID_PAYMENT_BODY;
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/corridorId/i);
  });

  it('returns 400 when sourceCurrency is not USDC', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send({ ...VALID_PAYMENT_BODY, sourceCurrency: 'USD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/USDC/i);
  });

  it('returns 400 when sourceAmount is zero', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send({ ...VALID_PAYMENT_BODY, sourceAmount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/i);
  });

  it('returns 400 when sourceAmount is negative', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send({ ...VALID_PAYMENT_BODY, sourceAmount: -5 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when recipient is missing', async () => {
    const { recipient: _r, ...body } = VALID_PAYMENT_BODY;
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipient/i);
  });
});

// ─── GET /v1/remittance/payments/:id ─────────────────────────────────────────

describe('GET /v1/remittance/payments/:id (integration)', () => {
  const app = buildApp();

  it('returns payment status for any paymentId', async () => {
    const res = await request(app)
      .get('/v1/remittance/payments/pay-test-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('pay-test-123');
    expect(typeof res.body.data.status).toBe('string');
    expect(typeof res.body.data.sourceAmount).toBe('number');
  });

  it('returns processing status from sandbox', async () => {
    const res = await request(app)
      .get('/v1/remittance/payments/any-id');

    expect(res.body.data.status).toBe('processing');
  });
});

// ─── GET /v1/remittance/payments/:id/settlement ──────────────────────────────

describe('GET /v1/remittance/payments/:id/settlement (integration)', () => {
  const app = buildApp();

  it('returns settlement info for any paymentId', async () => {
    const res = await request(app)
      .get('/v1/remittance/payments/pay-settle-123/settlement');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentId).toBe('pay-settle-123');
    expect(typeof res.body.data.settlementId).toBe('string');
    expect(typeof res.body.data.status).toBe('string');
    expect(typeof res.body.data.settledAmount).toBe('number');
    expect(typeof res.body.data.settledCurrency).toBe('string');
  });
});

// ─── POST /v1/bank/verify ────────────────────────────────────────────────────

describe('POST /v1/bank/verify (integration)', () => {
  const app = buildApp();

  it('verifies bank account and returns account details', async () => {
    const res = await request(app)
      .post('/v1/bank/verify')
      .send({ accountNumber: '0690000031', bankCode: '044' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountNumber).toBe('0690000031');
    expect(res.body.data.bankCode).toBe('044');
    expect(typeof res.body.data.accountName).toBe('string');
    expect(res.body.data.accountName.length).toBeGreaterThan(0);
  });

  it('returns 400 when accountNumber is missing', async () => {
    const res = await request(app)
      .post('/v1/bank/verify')
      .send({ bankCode: '044' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accountNumber/i);
  });

  it('returns 400 when bankCode is missing', async () => {
    const res = await request(app)
      .post('/v1/bank/verify')
      .send({ accountNumber: '0690000031' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bankCode/i);
  });
});

// ─── POST /v1/payment/webhook/flutterwave ────────────────────────────────────

describe('POST /v1/payment/webhook/flutterwave (integration)', () => {
  const app = buildApp();

  it('accepts Flutterwave webhook with verif-hash header', async () => {
    const payload = {
      event: 'transfer.completed',
      data: { id: 1001, tx_ref: 'ref-abc', status: 'SUCCESSFUL', amount: 5000, currency: 'NGN' },
    };

    const res = await request(app)
      .post('/v1/payment/webhook/flutterwave')
      .set('verif-hash', 'my-webhook-hash')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
  });

  it('accepts Flutterwave webhook without hash header (sandbox)', async () => {
    const res = await request(app)
      .post('/v1/payment/webhook/flutterwave')
      .send({ event: 'transfer.failed', data: {} });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });
});

// ─── POST /v1/payment/webhook/yellowcard ─────────────────────────────────────

describe('POST /v1/payment/webhook/yellowcard (integration)', () => {
  const app = buildApp();

  it('accepts YellowCard webhook with signature header', async () => {
    const payload = {
      event: 'payment.completed',
      data: { id: 'pay_xyz', status: 'completed' },
    };

    const res = await request(app)
      .post('/v1/payment/webhook/yellowcard')
      .set('x-yellowcard-signature', 'sha256=abc123def456')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
  });

  it('accepts YellowCard webhook without signature header (sandbox)', async () => {
    const res = await request(app)
      .post('/v1/payment/webhook/yellowcard')
      .send({ event: 'payment.failed' });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });
});
