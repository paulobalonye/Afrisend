/**
 * User service route tests — TDD
 *
 * Tests: GET/PATCH /v1/users/me and full recipients CRUD.
 * Uses mocked IUserService injected via createApp.
 */

import request from 'supertest';
import { createApp } from '@/server/app';
import type { IOtpService } from '@/server/services/otpService';
import type { IAuthService } from '@/server/services/authService';
import type { IKycService } from '@/server/services/kycService';
import type { IRemittanceService } from '@/server/services/remittanceService';
import type { IUserService } from '@/server/services/userService';

// ─── Mock services ────────────────────────────────────────────────────────────

const mockOtpService: IOtpService = {
  sendSmsOtp: jest.fn(),
  verifySmsOtp: jest.fn(),
  sendEmailOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
  getSmsDeliveryStatus: jest.fn(),
};

const mockAuthService: IAuthService = {
  register: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  setupProfile: jest.fn(),
};

const mockKycService: IKycService = {
  createSession: jest.fn(),
  getSession: jest.fn(),
  uploadDocument: jest.fn(),
  uploadSelfie: jest.fn(),
  uploadAddressProof: jest.fn(),
  getLivenessToken: jest.fn(),
  submitSession: jest.fn(),
  createVeriffSession: jest.fn(),
  getVeriffDecision: jest.fn(),
  handleVeriffWebhook: jest.fn(),
};

const mockRemittanceService: IRemittanceService = {
  listCorridors: jest.fn(),
  getRates: jest.fn(),
  initiatePayment: jest.fn(),
  getPaymentStatus: jest.fn(),
  getSettlement: jest.fn(),
  verifyBankAccount: jest.fn(),
  handleFlutterwaveWebhook: jest.fn(),
  handleYellowCardWebhook: jest.fn(),
};

const MOCK_PROFILE = {
  id: 'user-1',
  email: 'ada@test.com',
  phone: '+234801000',
  firstName: 'Ada',
  lastName: 'Obi',
  displayName: 'Ada Obi',
  residenceCountry: 'NG',
  preferredCurrency: 'NGN',
  notificationPreferences: { email: true, sms: true, push: true },
  kycTier: 0,
  kycStatus: 'none',
  monthlyLimit: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

const MOCK_RECIPIENT = {
  id: 'rec-1',
  userId: 'user-1',
  name: 'John Doe',
  country: 'KE',
  payoutMethod: 'mobile_money' as const,
  accountDetails: { type: 'mobile_money' as const, phoneNumber: '+254700123456', provider: 'M-Pesa' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockUserService: IUserService = {
  getProfile: jest.fn().mockResolvedValue(MOCK_PROFILE),
  updateProfile: jest.fn().mockResolvedValue({ ...MOCK_PROFILE, displayName: 'Updated' }),
  listRecipients: jest.fn().mockResolvedValue([MOCK_RECIPIENT]),
  createRecipient: jest.fn().mockResolvedValue(MOCK_RECIPIENT),
  updateRecipient: jest.fn().mockResolvedValue({ ...MOCK_RECIPIENT, name: 'Updated Name' }),
  deleteRecipient: jest.fn().mockResolvedValue(undefined),
  updateTierFromKyc: jest.fn().mockResolvedValue({ ...MOCK_PROFILE, kycTier: 1, monthlyLimit: 500 }),
};

// ─── App setup ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(() => {
  app = createApp({
    otpService: mockOtpService,
    authService: mockAuthService,
    kycService: mockKycService,
    remittanceService: mockRemittanceService,
    userService: mockUserService,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset resolved values to defaults after clearAllMocks
  (mockUserService.getProfile as jest.Mock).mockResolvedValue(MOCK_PROFILE);
  (mockUserService.updateProfile as jest.Mock).mockResolvedValue({ ...MOCK_PROFILE, displayName: 'Updated' });
  (mockUserService.listRecipients as jest.Mock).mockResolvedValue([MOCK_RECIPIENT]);
  (mockUserService.createRecipient as jest.Mock).mockResolvedValue(MOCK_RECIPIENT);
  (mockUserService.updateRecipient as jest.Mock).mockResolvedValue({ ...MOCK_RECIPIENT, name: 'Updated Name' });
  (mockUserService.deleteRecipient as jest.Mock).mockResolvedValue(undefined);
  (mockUserService.updateTierFromKyc as jest.Mock).mockResolvedValue({ ...MOCK_PROFILE, kycTier: 1, monthlyLimit: 500 });
});

// ─── GET /v1/users/me ─────────────────────────────────────────────────────────

describe('GET /v1/users/me', () => {
  it('returns 200 with user profile', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('user-1');
    expect(res.body.data.displayName).toBe('Ada Obi');
    expect(res.body.data.kycTier).toBe(0);
    expect(res.body.data.monthlyLimit).toBe(0);
    expect(mockUserService.getProfile).toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/v1/users/me');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /v1/users/me ───────────────────────────────────────────────────────

describe('PATCH /v1/users/me', () => {
  it('updates and returns user profile', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ displayName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Updated');
    expect(mockUserService.updateProfile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ displayName: 'Updated' }),
    );
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).patch('/v1/users/me').send({ displayName: 'X' });
    expect(res.status).toBe(401);
  });

  it('accepts partial updates (only notification preferences)', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ notificationPreferences: { sms: false } });

    expect(res.status).toBe(200);
    expect(mockUserService.updateProfile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ notificationPreferences: { sms: false } }),
    );
  });
});

// ─── GET /v1/users/me/recipients ─────────────────────────────────────────────

describe('GET /v1/users/me/recipients', () => {
  it('returns list of recipients', async () => {
    const res = await request(app)
      .get('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('rec-1');
    expect(mockUserService.listRecipients).toHaveBeenCalled();
  });

  it('returns 401 when unauthorized', async () => {
    const res = await request(app).get('/v1/users/me/recipients');
    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/users/me/recipients ────────────────────────────────────────────

describe('POST /v1/users/me/recipients', () => {
  const VALID_MOBILE_MONEY_BODY = {
    name: 'John Doe',
    country: 'KE',
    payoutMethod: 'mobile_money',
    accountDetails: { type: 'mobile_money', phoneNumber: '+254700123456', provider: 'M-Pesa' },
  };

  const VALID_BANK_BODY = {
    name: 'Jane Ade',
    country: 'NG',
    payoutMethod: 'bank_transfer',
    accountDetails: { type: 'bank_transfer', accountNumber: '0690000031', bankCode: '044', bankName: 'Access Bank' },
  };

  it('creates a mobile money recipient', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send(VALID_MOBILE_MONEY_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('rec-1');
    expect(mockUserService.createRecipient).toHaveBeenCalled();
  });

  it('creates a bank transfer recipient', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send(VALID_BANK_BODY);

    expect(res.status).toBe(200);
    expect(mockUserService.createRecipient).toHaveBeenCalled();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send({ country: 'NG', payoutMethod: 'bank_transfer', accountDetails: VALID_BANK_BODY.accountDetails });

    expect(res.status).toBe(400);
  });

  it('returns 400 when country is missing', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 'X', payoutMethod: 'bank_transfer', accountDetails: VALID_BANK_BODY.accountDetails });

    expect(res.status).toBe(400);
  });

  it('returns 400 when payoutMethod is invalid', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 'X', country: 'NG', payoutMethod: 'cash', accountDetails: VALID_BANK_BODY.accountDetails });

    expect(res.status).toBe(400);
  });

  it('returns 400 when accountDetails is missing', async () => {
    const res = await request(app)
      .post('/v1/users/me/recipients')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 'X', country: 'NG', payoutMethod: 'bank_transfer' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthorized', async () => {
    const res = await request(app).post('/v1/users/me/recipients').send(VALID_MOBILE_MONEY_BODY);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /v1/users/me/recipients/:id ───────────────────────────────────────

describe('PATCH /v1/users/me/recipients/:id', () => {
  it('updates recipient and returns updated record', async () => {
    const res = await request(app)
      .patch('/v1/users/me/recipients/rec-1')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
    expect(mockUserService.updateRecipient).toHaveBeenCalledWith(
      expect.any(String),
      'rec-1',
      expect.objectContaining({ name: 'Updated Name' }),
    );
  });

  it('returns 404 when recipient not found', async () => {
    (mockUserService.updateRecipient as jest.Mock).mockRejectedValue(new Error('Recipient not found'));

    const res = await request(app)
      .patch('/v1/users/me/recipients/bad-id')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthorized', async () => {
    const res = await request(app)
      .patch('/v1/users/me/recipients/rec-1')
      .send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /v1/users/me/recipients/:id ──────────────────────────────────────

describe('DELETE /v1/users/me/recipients/:id', () => {
  it('deletes recipient and returns 200', async () => {
    const res = await request(app)
      .delete('/v1/users/me/recipients/rec-1')
      .set('Authorization', 'Bearer acc-tok');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUserService.deleteRecipient).toHaveBeenCalledWith(expect.any(String), 'rec-1');
  });

  it('returns 404 when recipient not found', async () => {
    (mockUserService.deleteRecipient as jest.Mock).mockRejectedValue(new Error('Recipient not found'));

    const res = await request(app)
      .delete('/v1/users/me/recipients/bad-id')
      .set('Authorization', 'Bearer acc-tok');

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthorized', async () => {
    const res = await request(app).delete('/v1/users/me/recipients/rec-1');
    expect(res.status).toBe(401);
  });
});

// ─── requireAuth edge cases ───────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('returns 401 for Bearer with empty token (Bearer<space>)', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-Bearer scheme', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /v1/users/me — validation edge cases ───────────────────────────────

describe('PATCH /v1/users/me — validation', () => {
  it('returns 400 when displayName is not a string', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ displayName: 42 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when residenceCountry is not a string', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ residenceCountry: true });
    expect(res.status).toBe(400);
  });

  it('returns 400 when preferredCurrency is not a string', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ preferredCurrency: ['NGN'] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when notificationPreferences is not an object', async () => {
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer acc-tok')
      .send({ notificationPreferences: 'yes' });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /v1/users/me/recipients/:id — validation edge cases ───────────────

describe('PATCH /v1/users/me/recipients/:id — validation', () => {
  it('returns 400 when name is not a string', async () => {
    const res = await request(app)
      .patch('/v1/users/me/recipients/rec-1')
      .set('Authorization', 'Bearer acc-tok')
      .send({ name: 123 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when country is not a string', async () => {
    const res = await request(app)
      .patch('/v1/users/me/recipients/rec-1')
      .set('Authorization', 'Bearer acc-tok')
      .send({ country: 99 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when payoutMethod is invalid', async () => {
    const res = await request(app)
      .patch('/v1/users/me/recipients/rec-1')
      .set('Authorization', 'Bearer acc-tok')
      .send({ payoutMethod: 'cash' });
    expect(res.status).toBe(400);
  });
});
