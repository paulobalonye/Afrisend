/**
 * KYC routes integration tests — real DefaultKycService, no mocks.
 *
 * Covers all KYC routes including file uploads (multipart), webhook handling,
 * and Veriff sub-routes. Uses supertest with buffer uploads for multer routes.
 *
 * CI-safe: no external API calls required.
 */

import request from 'supertest';
import { createApp } from '@/server/app';
import { DefaultOtpService } from '@/server/services/otpService';
import { DefaultAuthService } from '@/server/services/authService';
import { DefaultKycService } from '@/server/services/kycService';
import { DefaultRemittanceService } from '@/server/services/remittanceService';
import { DefaultUserService } from '@/server/services/userService';

function buildApp() {
  return createApp({
    otpService: new DefaultOtpService(),
    authService: new DefaultAuthService(),
    kycService: new DefaultKycService(),
    remittanceService: new DefaultRemittanceService(),
    userService: new DefaultUserService(),
  });
}

// Minimal 1x1 PNG buffer for file upload tests
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// ─── POST /v1/kyc/sessions ───────────────────────────────────────────────────

describe('POST /v1/kyc/sessions (integration)', () => {
  const app = buildApp();

  it('creates a KYC session and returns sessionId + status', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
    expect(res.body.data.sessionId.length).toBeGreaterThan(0);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.tier).toBe(1);
    expect(Array.isArray(res.body.data.documents)).toBe(true);
    expect(typeof res.body.data.createdAt).toBe('string');
    expect(typeof res.body.data.updatedAt).toBe('string');
  });

  it('generates unique sessionIds for each call', async () => {
    const r1 = await request(app).post('/v1/kyc/sessions').send();
    const r2 = await request(app).post('/v1/kyc/sessions').send();

    expect(r1.body.data.sessionId).not.toBe(r2.body.data.sessionId);
  });
});

// ─── GET /v1/kyc/sessions/current ────────────────────────────────────────────

describe('GET /v1/kyc/sessions/current (integration)', () => {
  const app = buildApp();

  it('returns a session object', async () => {
    const res = await request(app).get('/v1/kyc/sessions/current');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
    expect(res.body.data.status).toBe('pending');
  });
});

// ─── POST /v1/kyc/sessions/:sessionId/documents ──────────────────────────────

describe('POST /v1/kyc/sessions/:sessionId/documents (integration)', () => {
  const app = buildApp();

  it('uploads a passport document (front side)', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('documentType', 'passport')
      .field('side', 'front')
      .attach('document', MINIMAL_PNG, { filename: 'passport.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.type).toBe('passport');
    expect(res.body.data.side).toBe('front');
    expect(res.body.data.status).toBe('pending');
    expect(typeof res.body.data.uploadedAt).toBe('string');
  });

  it('uploads a national_id document (back side)', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('documentType', 'national_id')
      .field('side', 'back')
      .attach('document', MINIMAL_PNG, { filename: 'id_back.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('national_id');
    expect(res.body.data.side).toBe('back');
  });

  it('uploads a driver_license document', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('documentType', 'driver_license')
      .field('side', 'front')
      .attach('document', MINIMAL_PNG, { filename: 'dl.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('driver_license');
  });

  it('returns 400 when document file is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('documentType', 'passport')
      .field('side', 'front');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/document file/i);
  });

  it('returns 400 when documentType is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('side', 'front')
      .attach('document', MINIMAL_PNG, { filename: 'doc.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/documentType/i);
  });

  it('returns 400 when side is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/documents')
      .field('documentType', 'passport')
      .attach('document', MINIMAL_PNG, { filename: 'doc.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/side/i);
  });
});

// ─── POST /v1/kyc/sessions/:sessionId/selfie ─────────────────────────────────

describe('POST /v1/kyc/sessions/:sessionId/selfie (integration)', () => {
  const app = buildApp();

  it('uploads a selfie successfully', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/selfie')
      .attach('selfie', MINIMAL_PNG, { filename: 'selfie.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.status).toBe('pending');
  });

  it('returns 400 when selfie file is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/selfie');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/selfie/i);
  });
});

// ─── POST /v1/kyc/sessions/:sessionId/address ────────────────────────────────

describe('POST /v1/kyc/sessions/:sessionId/address (integration)', () => {
  const app = buildApp();

  it('uploads address proof successfully', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/address')
      .attach('document', MINIMAL_PNG, { filename: 'address.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.id).toBe('string');
  });

  it('returns 400 when document file is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/address');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/document file/i);
  });
});

// ─── POST /v1/kyc/sessions/:sessionId/liveness-token ────────────────────────

describe('POST /v1/kyc/sessions/:sessionId/liveness-token (integration)', () => {
  const app = buildApp();

  it('returns a liveness token', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/liveness-token')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(typeof res.body.data.provider).toBe('string');
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── POST /v1/kyc/sessions/:sessionId/submit ─────────────────────────────────

describe('POST /v1/kyc/sessions/:sessionId/submit (integration)', () => {
  const app = buildApp();

  it('submits session and returns updated session', async () => {
    const res = await request(app)
      .post('/v1/kyc/sessions/sess-123/submit')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
    expect(typeof res.body.data.status).toBe('string');
  });
});

// ─── POST /v1/kyc/veriff/sessions ────────────────────────────────────────────

describe('POST /v1/kyc/veriff/sessions (integration)', () => {
  const app = buildApp();

  it('creates a Veriff session with required fields', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ vendorData: 'user-ref-123', countryCode: 'NG' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.sessionId).toBe('string');
    expect(typeof res.body.data.sessionUrl).toBe('string');
    expect(res.body.data.vendorData).toBe('user-ref-123');
    expect(res.body.data.status).toBe('created');
  });

  it('creates a Veriff session with optional documentType', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ vendorData: 'user-ref-456', countryCode: 'GH', documentType: 'PASSPORT' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('created');
  });

  it('returns 400 when vendorData is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ countryCode: 'NG' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/vendorData/i);
  });

  it('returns 400 when countryCode is missing', async () => {
    const res = await request(app)
      .post('/v1/kyc/veriff/sessions')
      .send({ vendorData: 'user-ref' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/countryCode/i);
  });
});

// ─── GET /v1/kyc/veriff/sessions/:sessionId/decision ─────────────────────────

describe('GET /v1/kyc/veriff/sessions/:sessionId/decision (integration)', () => {
  const app = buildApp();

  it('returns a decision for any sessionId', async () => {
    const res = await request(app)
      .get('/v1/kyc/veriff/sessions/veriff-sess-abc/decision');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('veriff-sess-abc');
    expect(typeof res.body.data.status).toBe('string');
    expect(typeof res.body.data.code).toBe('number');
  });
});

// ─── POST /v1/kyc/webhook ─────────────────────────────────────────────────────

describe('POST /v1/kyc/webhook (integration)', () => {
  const app = buildApp();

  it('accepts webhook with signature header', async () => {
    const payload = { id: 'evt-1', code: 9001, action: 'submitted', status: 'approved' };

    const res = await request(app)
      .post('/v1/kyc/webhook')
      .set('x-hmac-signature', 'sha256=abc123')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
  });

  it('accepts webhook without signature header (sandbox)', async () => {
    const res = await request(app)
      .post('/v1/kyc/webhook')
      .send({ id: 'evt-2', code: 9001 });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });
});
