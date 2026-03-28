/**
 * Express server route tests — TDD
 *
 * Tests all v1 API routes with mocked service adapters.
 * Runs without real API keys (CI-safe).
 */

import request from 'supertest';
import { createApp } from '@/server/app';
import type { IOtpService } from '@/server/services/otpService';
import type { IKycService } from '@/server/services/kycService';
import type { IRemittanceService } from '@/server/services/remittanceService';
import type { IAuthService } from '@/server/services/authService';

// ─── Mock service implementations ────────────────────────────────────────────

const mockOtpService: IOtpService = {
  sendSmsOtp: jest.fn().mockResolvedValue({ sessionId: 'otp-sms-1', expiresAt: '2026-04-01T00:00:00Z' }),
  verifySmsOtp: jest.fn().mockResolvedValue({ verified: true, isNewUser: false, temporaryToken: 'tmp-tok-1' }),
  sendEmailOtp: jest.fn().mockResolvedValue({ sessionId: 'otp-email-1', expiresAt: '2026-04-01T00:00:00Z', messageId: 'msg-1' }),
  verifyEmailOtp: jest.fn().mockResolvedValue({ verified: true, token: 'email-tok-1' }),
  getSmsDeliveryStatus: jest.fn().mockResolvedValue({ sessionId: 'otp-sms-1', status: 'delivered', deliveredAt: '2026-03-28T10:00:00Z' }),
};

const mockAuthService: IAuthService = {
  register: jest.fn().mockResolvedValue({
    user: { id: 'usr-1', phone: '+2348012345678', email: 'a@b.com', firstName: 'Ada', lastName: 'Obi', kycTier: 0, kycStatus: 'none', createdAt: '2026-01-01T00:00:00Z' },
    tokens: { accessToken: 'acc-tok', refreshToken: 'ref-tok', expiresAt: '2026-04-01T00:00:00Z' },
  }),
  refreshToken: jest.fn().mockResolvedValue({ accessToken: 'new-acc-tok' }),
  logout: jest.fn().mockResolvedValue(undefined),
  setupProfile: jest.fn().mockResolvedValue({ id: 'usr-1', phone: '+2348012345678', email: 'a@b.com', firstName: 'Ada', lastName: 'Obi', kycTier: 0, kycStatus: 'none', createdAt: '2026-01-01T00:00:00Z' }),
};

const mockKycService: IKycService = {
  createSession: jest.fn().mockResolvedValue({ sessionId: 'kyc-sess-1', status: 'pending', tier: 1, documents: [], createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z' }),
  getSession: jest.fn().mockResolvedValue({ sessionId: 'kyc-sess-1', status: 'processing', tier: 1, documents: [], createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z' }),
  uploadDocument: jest.fn().mockResolvedValue({ id: 'doc-1', type: 'passport', side: 'front', status: 'pending', uploadedAt: '2026-03-28T10:00:00Z' }),
  uploadSelfie: jest.fn().mockResolvedValue({ id: 'doc-2', type: 'passport', side: 'front', status: 'pending', uploadedAt: '2026-03-28T10:00:00Z' }),
  uploadAddressProof: jest.fn().mockResolvedValue({ id: 'doc-3', type: 'passport', side: 'front', status: 'pending', uploadedAt: '2026-03-28T10:00:00Z' }),
  getLivenessToken: jest.fn().mockResolvedValue({ token: 'liveness-tok', provider: 'veriff', expiresAt: '2026-04-01T00:00:00Z' }),
  submitSession: jest.fn().mockResolvedValue({ sessionId: 'kyc-sess-1', status: 'processing', tier: 1, documents: [], createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z' }),
  createVeriffSession: jest.fn().mockResolvedValue({ sessionId: 'veriff-sess-1', sessionUrl: 'https://veriff.com/sess', vendorData: 'usr-1', status: 'created' }),
  getVeriffDecision: jest.fn().mockResolvedValue({ sessionId: 'veriff-sess-1', status: 'approved', code: 9001, reason: null, reasonCode: null, checkedAt: '2026-03-28T10:00:00Z' }),
  handleVeriffWebhook: jest.fn().mockResolvedValue({ received: true }),
};

const mockRemittanceService: IRemittanceService = {
  listCorridors: jest.fn().mockResolvedValue([{ id: 'cor-1', sourceCurrency: 'USDC', destinationCurrency: 'NGN', destinationCountry: 'NG', destinationCountryName: 'Nigeria', minAmount: 1, maxAmount: 10000, isActive: true, refreshIntervalSeconds: 60 }]),
  getRates: jest.fn().mockResolvedValue({ corridorId: 'cor-1', sourceCurrency: 'USDC', destinationCurrency: 'NGN', sourceAmount: 100, destinationAmount: 150000, exchangeRate: 1500, fee: 2, totalSourceAmount: 102, expiresAt: '2026-04-01T00:00:00Z', quoteId: 'qt-1' }),
  initiatePayment: jest.fn().mockResolvedValue({ id: 'pay-1', idempotencyKey: 'idem-1', corridorId: 'cor-1', sourceCurrency: 'USDC', destinationCurrency: 'NGN', sourceAmount: 100, destinationAmount: 150000, exchangeRate: 1500, fee: 2, status: 'pending', recipient: { name: 'John', accountNumber: '0001', bankCode: '044', bankName: 'Access' }, createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z' }),
  getPaymentStatus: jest.fn().mockResolvedValue({ id: 'pay-1', idempotencyKey: 'idem-1', corridorId: 'cor-1', sourceCurrency: 'USDC', destinationCurrency: 'NGN', sourceAmount: 100, destinationAmount: 150000, exchangeRate: 1500, fee: 2, status: 'completed', recipient: { name: 'John', accountNumber: '0001', bankCode: '044', bankName: 'Access' }, createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z' }),
  getSettlement: jest.fn().mockResolvedValue({ paymentId: 'pay-1', settlementId: 'set-1', status: 'settled', settledAmount: 150000, settledCurrency: 'NGN', settledAt: '2026-03-28T12:00:00Z' }),
  verifyBankAccount: jest.fn().mockResolvedValue({ accountName: 'JOHN DOE', accountNumber: '0690000031', bankCode: '044', bankName: 'Access Bank' }),
  handleFlutterwaveWebhook: jest.fn().mockResolvedValue({ received: true }),
  handleYellowCardWebhook: jest.fn().mockResolvedValue({ received: true }),
};

// ─── App setup ───────────────────────────────────────────────────────────────

let app: Express.Application;

beforeAll(() => {
  app = createApp({
    otpService: mockOtpService,
    authService: mockAuthService,
    kycService: mockKycService,
    remittanceService: mockRemittanceService,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Health check ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

// ─── Auth routes ─────────────────────────────────────────────────────────────

describe('POST /v1/auth/otp/send', () => {
  it('returns 200 with sessionId for valid phone', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678', countryCode: 'NG' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('otp-sms-1');
    expect(mockOtpService.sendSmsOtp).toHaveBeenCalledWith('+2348012345678', 'NG');
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ countryCode: 'NG' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 when countryCode is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /v1/auth/otp/verify', () => {
  it('returns 200 with verification result', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId: 'otp-sms-1', code: '123456', phone: '+2348012345678' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.temporaryToken).toBe('tmp-tok-1');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId: 'otp-sms-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /v1/auth/otp/delivery-status', () => {
  it('returns delivery status for sessionId', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/delivery-status')
      .send({ sessionId: 'otp-sms-1' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('delivered');
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/delivery-status')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/auth/email/otp/send', () => {
  it('returns 200 with sessionId for valid email', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/send')
      .send({ email: 'ada@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('otp-email-1');
    expect(mockOtpService.sendEmailOtp).toHaveBeenCalledWith('ada@example.com', undefined);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/send')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /v1/auth/email/otp/verify', () => {
  it('returns 200 with verification result', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ sessionId: 'otp-email-1', code: '654321', email: 'ada@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ sessionId: 'otp-email-1' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/auth/register', () => {
  it('registers user and returns tokens', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ temporaryToken: 'tmp-tok-1', firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com', password: 'Passw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBe('acc-tok');
    expect(res.body.data.user.firstName).toBe('Ada');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ firstName: 'Ada' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/auth/refresh', () => {
  it('returns new access token', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'ref-tok' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-acc-tok');
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/auth/logout', () => {
  it('returns 200', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', 'Bearer acc-tok');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /v1/users/me/profile', () => {
  it('sets up user profile', async () => {
    const res = await request(app)
      .post('/v1/users/me/profile')
      .send({ dateOfBirth: '1990-01-01', nationality: 'NG', residenceCountry: 'GB', purpose: 'family' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('usr-1');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/v1/users/me/profile')
      .send({ nationality: 'NG' });

    expect(res.status).toBe(400);
  });
});

// ─── KYC routes ──────────────────────────────────────────────────────────────

describe('POST /v1/kyc/sessions', () => {
  it('creates a KYC session', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe('kyc-sess-1');
    expect(mockKycService.createSession).toHaveBeenCalled();
  });
});

describe('GET /v1/kyc/sessions/current', () => {
  it('returns current KYC session', async () => {
    const res = await request(app)
      .get('/v1/kyc/sessions/current');

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe('kyc-sess-1');
  });
});

describe('POST /v1/kyc/sessions/:sessionId/liveness-token', () => {
  it('returns liveness token', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/kyc-sess-1/liveness-token');

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('liveness-tok');
  });
});

describe('POST /v1/kyc/sessions/:sessionId/submit', () => {
  it('submits a KYC session', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/kyc-sess-1/submit');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('processing');
  });
});

describe('POST /v1/kyc/veriff/sessions', () => {
  it('creates Veriff session', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ vendorData: 'usr-1', countryCode: 'NG', documentType: 'passport' });

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe('veriff-sess-1');
    expect(res.body.data.sessionUrl).toBeTruthy();
  });

  it('returns 400 when vendorData is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ countryCode: 'NG' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/kyc/webhook', () => {
  it('returns 200 for valid webhook payload', async () => {
    const res = await request(app)
      .post('/v1/kyc/webhook')
      .set('x-hmac-signature', 'test-sig')
      .send({ id: 'evt-1', code: 9001 });

    expect(res.status).toBe(200);
  });
});

// ─── Remittance routes ───────────────────────────────────────────────────────

describe('GET /v1/remittance/corridors', () => {
  it('returns list of corridors', async () => {
    const res = await request(app).get('/v1/remittance/corridors');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].destinationCurrency).toBe('NGN');
  });
});

describe('GET /v1/remittance/v2/rates', () => {
  it('returns rate quote for corridor', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-1', sourceAmount: '100' });

    expect(res.status).toBe(200);
    expect(res.body.data.exchangeRate).toBe(1500);
    expect(mockRemittanceService.getRates).toHaveBeenCalledWith({ corridorId: 'cor-1', sourceAmount: 100 });
  });

  it('returns 400 when corridorId is missing', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ sourceAmount: '100' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceAmount is missing', async () => {
    const res = await request(app)
      .get('/v1/remittance/v2/rates')
      .query({ corridorId: 'cor-1' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/remittance/payments', () => {
  it('initiates a payment', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send({
        idempotencyKey: 'idem-1',
        quoteId: 'qt-1',
        corridorId: 'cor-1',
        sourceCurrency: 'USDC',
        sourceAmount: 100,
        recipient: { name: 'John', accountNumber: '0001', bankCode: '044', bankName: 'Access' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('pay-1');
    expect(res.body.data.status).toBe('pending');
  });

  it('returns 400 when required payment fields are missing', async () => {
    const res = await request(app)
      .post('/v1/remittance/payments')
      .send({ corridorId: 'cor-1' });

    expect(res.status).toBe(400);
  });
});

describe('GET /v1/remittance/payments/:id', () => {
  it('returns payment status', async () => {
    const res = await request(app).get('/v1/remittance/payments/pay-1');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});

describe('GET /v1/remittance/payments/:id/settlement', () => {
  it('returns settlement info', async () => {
    const res = await request(app).get('/v1/remittance/payments/pay-1/settlement');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('settled');
  });
});

// ─── Bank verification ───────────────────────────────────────────────────────

describe('POST /v1/bank/verify', () => {
  it('verifies bank account', async () => {
    const res = await request(app)
      .post('/v1/bank/verify')
      .send({ accountNumber: '0690000031', bankCode: '044' });

    expect(res.status).toBe(200);
    expect(res.body.data.accountName).toBe('JOHN DOE');
  });

  it('returns 400 when accountNumber is missing', async () => {
    const res = await request(app)
      .post('/v1/bank/verify')
      .send({ bankCode: '044' });

    expect(res.status).toBe(400);
  });
});

// ─── Webhook routes ───────────────────────────────────────────────────────────

describe('POST /v1/payment/webhook/flutterwave', () => {
  it('accepts valid webhook', async () => {
    const res = await request(app)
      .post('/v1/payment/webhook/flutterwave')
      .set('verif-hash', 'test-hash')
      .send({ event: 'transfer.completed', data: { id: 1, status: 'SUCCESSFUL' } });

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/payment/webhook/yellowcard', () => {
  it('accepts valid webhook', async () => {
    const res = await request(app)
      .post('/v1/payment/webhook/yellowcard')
      .set('x-yellowcard-signature', 'test-sig')
      .send({ event: 'payment.completed', data: { id: 'pay-1' } });

    expect(res.status).toBe(200);
  });
});

// ─── Error handling ──────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 on unexpected service error', async () => {
    (mockOtpService.sendSmsOtp as jest.Mock).mockRejectedValueOnce(new Error('Twilio down'));

    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678', countryCode: 'NG' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
