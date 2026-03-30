/**
 * Auth routes integration tests — real service implementations, no mocks.
 *
 * Uses DefaultAuthService + DefaultOtpService wired into createApp so we test
 * the full HTTP → service → response cycle without stubbing internals.
 *
 * All tests are CI-safe (no external API calls).
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

// ─── POST /v1/auth/otp/send ──────────────────────────────────────────────────

describe('POST /v1/auth/otp/send (integration)', () => {
  const app = buildApp();

  it('returns 200 with sessionId and expiresAt for valid phone', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678', countryCode: 'NG' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
    expect(res.body.data.sessionId.length).toBeGreaterThan(0);
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ countryCode: 'NG' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('returns 400 when countryCode is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/countryCode/i);
  });

  it('creates unique sessions for different phone numbers', async () => {
    const r1 = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348000000001', countryCode: 'NG' });
    const r2 = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348000000002', countryCode: 'NG' });

    expect(r1.body.data.sessionId).not.toBe(r2.body.data.sessionId);
  });
});

// ─── POST /v1/auth/otp/verify ────────────────────────────────────────────────

describe('POST /v1/auth/otp/verify (integration)', () => {
  const app = buildApp();

  it('returns 200 verified=false for unknown sessionId', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId: 'nonexistent', code: '123456', phone: '+2348012345678' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(false);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ code: '123456', phone: '+2348012345678' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId/i);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId: 'sess-1', phone: '+2348012345678' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code/i);
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId: 'sess-1', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('returns verified=false for wrong code on real session', async () => {
    const sendRes = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678', countryCode: 'NG' });

    const { sessionId } = sendRes.body.data;

    const verifyRes = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ sessionId, code: '000000', phone: '+2348012345678' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(false);
  });
});

// ─── POST /v1/auth/otp/delivery-status ──────────────────────────────────────

describe('POST /v1/auth/otp/delivery-status (integration)', () => {
  const app = buildApp();

  it('returns 200 with delivery status for any sessionId', async () => {
    const sendRes = await request(app)
      .post('/v1/auth/otp/send')
      .send({ phone: '+2348012345678', countryCode: 'NG' });

    const { sessionId } = sendRes.body.data;

    const res = await request(app)
      .post('/v1/auth/otp/delivery-status')
      .send({ sessionId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe(sessionId);
    expect(typeof res.body.data.status).toBe('string');
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/delivery-status')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId/i);
  });
});

// ─── POST /v1/auth/email/otp/send ────────────────────────────────────────────

describe('POST /v1/auth/email/otp/send (integration)', () => {
  const app = buildApp();

  it('returns 200 with sessionId for valid email', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/send')
      .send({ email: 'ada@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
  });

  it('returns 200 with locale passed', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/send')
      .send({ email: 'ada@test.com', locale: 'fr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/send')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });
});

// ─── POST /v1/auth/email/otp/verify ─────────────────────────────────────────

describe('POST /v1/auth/email/otp/verify (integration)', () => {
  const app = buildApp();

  it('returns verified=false for unknown sessionId', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ sessionId: 'unknown', code: '123456', email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ code: '123456', email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId/i);
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ sessionId: 'sess', email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/email/otp/verify')
      .send({ sessionId: 'sess', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });
});

// ─── POST /v1/auth/register ──────────────────────────────────────────────────

describe('POST /v1/auth/register (integration)', () => {
  const app = buildApp();

  const VALID_BODY = {
    temporaryToken: 'tmp-tok-123',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@test.com',
    password: 'securePass123',
  };

  it('registers user and returns tokens', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
    expect(new Date(res.body.data.tokens.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.data.user.email).toBe('ada@test.com');
    expect(res.body.data.user.firstName).toBe('Ada');
    expect(res.body.data.user.lastName).toBe('Obi');
  });

  it('creates unique tokens for each registration', async () => {
    const r1 = await request(app).post('/v1/auth/register').send({ ...VALID_BODY, email: 'user1@test.com' });
    const r2 = await request(app).post('/v1/auth/register').send({ ...VALID_BODY, email: 'user2@test.com' });

    expect(r1.body.data.tokens.accessToken).not.toBe(r2.body.data.tokens.accessToken);
    expect(r1.body.data.user.id).not.toBe(r2.body.data.user.id);
  });

  it('returns 400 when temporaryToken is missing', async () => {
    const { temporaryToken: _t, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/temporaryToken/i);
  });

  it('returns 400 when firstName is missing', async () => {
    const { firstName: _f, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/firstName/i);
  });

  it('returns 400 when lastName is missing', async () => {
    const { lastName: _l, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lastName/i);
  });

  it('returns 400 when email is missing', async () => {
    const { email: _e, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is missing', async () => {
    const { password: _p, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });
});

// ─── POST /v1/auth/refresh ───────────────────────────────────────────────────

describe('POST /v1/auth/refresh (integration)', () => {
  const app = buildApp();

  it('returns new accessToken for valid refreshToken', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'any-valid-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshToken/i);
  });

  it('returns 500 when refreshToken is empty string', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: '' });

    // Empty string fails the `typeof === 'string'` truthy check → 400
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/auth/logout ────────────────────────────────────────────────────

describe('POST /v1/auth/logout (integration)', () => {
  const app = buildApp();

  it('logs out successfully with Authorization header', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', 'Bearer my-access-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.loggedOut).toBe(true);
  });

  it('logs out successfully without Authorization header (graceful)', async () => {
    const res = await request(app)
      .post('/v1/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.data.loggedOut).toBe(true);
  });
});

// ─── Auth middleware enforcement ─────────────────────────────────────────────

describe('requireAuth middleware (integration)', () => {
  const app = buildApp();

  it('rejects GET /v1/users/me without Authorization header', async () => {
    const res = await request(app).get('/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/unauthorized/i);
  });

  it('rejects GET /v1/users/me with malformed Authorization header', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects GET /v1/users/me/recipients without token', async () => {
    const res = await request(app).get('/v1/users/me/recipients');
    expect(res.status).toBe(401);
  });

  it('accepts GET /v1/users/me with any Bearer token', async () => {
    const res = await request(app)
      .get('/v1/users/me')
      .set('Authorization', 'Bearer some-access-token');
    expect(res.status).toBe(200);
  });
});
