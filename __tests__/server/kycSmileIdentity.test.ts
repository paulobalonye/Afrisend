/**
 * KYC Smile Identity service tests — TDD
 *
 * Tests the SmileIdentityKycService implementation:
 *  - submitKyc: initiate verification for a user
 *  - getKycStatus: retrieve current KYC status
 *  - handleSmileWebhook: process async Smile Identity callbacks
 *
 * All Smile Identity HTTP calls are mocked so tests are CI-safe.
 */

import crypto from 'crypto';
import request from 'supertest';
import express from 'express';
import { SmileIdentityKycService } from '@/server/services/smileIdentityKycService';
import type { SmileIdentityAdapter } from '@/server/adapters/smileIdentityAdapter';
import { DefaultSmileIdentityAdapter } from '@/server/adapters/smileIdentityAdapter';
import { createKycSmileRouter } from '@/server/routes/kycSmile';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAdapter(overrides: Partial<SmileIdentityAdapter> = {}): SmileIdentityAdapter {
  return {
    submitJob: jest.fn().mockResolvedValue({
      smileJobId: 'smile-job-001',
      resultCode: '0810',
      resultText: 'Enrol User',
      actions: { Verify_ID_Number: 'Verified' },
    }),
    getJobStatus: jest.fn().mockResolvedValue({
      smileJobId: 'smile-job-001',
      resultCode: '0810',
      resultText: 'Enrol User',
      complete: true,
    }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

// ─── SmileIdentityKycService ─────────────────────────────────────────────────

describe('SmileIdentityKycService', () => {
  let adapter: SmileIdentityAdapter;
  let service: SmileIdentityKycService;

  beforeEach(() => {
    adapter = makeAdapter();
    service = new SmileIdentityKycService(adapter);
  });

  // ── submitKyc ────────────────────────────────────────────────────────────

  describe('submitKyc', () => {
    it('returns a submission with pending status on success', async () => {
      const result = await service.submitKyc('user-1', 1, 'national_id', Buffer.from('fake-image'));

      expect(result.userId).toBe('user-1');
      expect(result.tier).toBe(1);
      expect(result.status).toBe('pending');
      expect(result.providerReference).toBeTruthy();
      expect(result.submittedAt).toBeTruthy();
    });

    it('calls the adapter with correct tier and document type', async () => {
      await service.submitKyc('user-1', 2, 'passport', Buffer.from('selfie'));

      expect(adapter.submitJob).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tier: 2,
          documentType: 'passport',
        }),
      );
    });

    it('returns provider reference from adapter response', async () => {
      const result = await service.submitKyc('user-1', 1, 'national_id', Buffer.from('img'));

      expect(result.providerReference).toBe('smile-job-001');
    });

    it('throws on adapter failure', async () => {
      const failAdapter = makeAdapter({
        submitJob: jest.fn().mockRejectedValue(new Error('Smile API error')),
      });
      const svc = new SmileIdentityKycService(failAdapter);

      await expect(svc.submitKyc('user-1', 1, 'national_id', Buffer.from('img'))).rejects.toThrow('Smile API error');
    });

    it('accepts all supported document types', async () => {
      const types: Array<'national_id' | 'passport' | 'driver_license'> = ['national_id', 'passport', 'driver_license'];

      for (const docType of types) {
        const result = await service.submitKyc('user-1', 1, docType, Buffer.from('img'));
        expect(result.tier).toBe(1);
      }

      expect(adapter.submitJob).toHaveBeenCalledTimes(3);
    });
  });

  // ── getKycStatus ─────────────────────────────────────────────────────────

  describe('getKycStatus', () => {
    it('returns not_started when user has no submissions', async () => {
      const result = await service.getKycStatus('user-with-no-submissions');

      expect(result.userId).toBe('user-with-no-submissions');
      expect(result.currentTier).toBe(0);
      expect(result.status).toBe('none');
    });

    it('returns status of latest submission after submit', async () => {
      await service.submitKyc('user-2', 1, 'national_id', Buffer.from('img'));

      const result = await service.getKycStatus('user-2');

      expect(result.userId).toBe('user-2');
      expect(result.currentTier).toBe(0); // tier only upgrades after webhook approval
      expect(result.status).toBe('pending');
    });

    it('reflects approved status after approval webhook', async () => {
      await service.submitKyc('user-3', 1, 'national_id', Buffer.from('img'));

      // Simulate approval webhook
      const webhookPayload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: { Verify_ID_Number: 'Verified' },
      };
      const sig = 'valid-sig';
      await service.handleSmileWebhook(webhookPayload, sig);

      const result = await service.getKycStatus('user-3');
      expect(result.status).toBe('approved');
      expect(result.currentTier).toBe(1);
    });

    it('reflects rejected status after rejection webhook', async () => {
      await service.submitKyc('user-4', 1, 'national_id', Buffer.from('img'));

      const webhookPayload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0820',
        ResultText: 'ID Not Verified',
        Actions: { Verify_ID_Number: 'Not Verified' },
      };
      await service.handleSmileWebhook(webhookPayload, 'valid-sig');

      const result = await service.getKycStatus('user-4');
      expect(result.status).toBe('rejected');
    });
  });

  // ── handleSmileWebhook ───────────────────────────────────────────────────

  describe('handleSmileWebhook', () => {
    it('returns received: true for valid webhook', async () => {
      const payload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: { Verify_ID_Number: 'Verified' },
      };

      const result = await service.handleSmileWebhook(payload, 'valid-sig');

      expect(result.received).toBe(true);
    });

    it('throws for invalid webhook signature', async () => {
      const badSigAdapter = makeAdapter({
        verifyWebhookSignature: jest.fn().mockReturnValue(false),
      });
      const svc = new SmileIdentityKycService(badSigAdapter);

      await expect(
        svc.handleSmileWebhook({ SmileJobID: 'x' }, 'bad-sig'),
      ).rejects.toThrow(/invalid.*signature/i);
    });

    it('upgrades user tier to 1 on successful Tier 1 verification', async () => {
      await service.submitKyc('user-5', 1, 'national_id', Buffer.from('img'));

      const payload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: { Verify_ID_Number: 'Verified' },
      };
      await service.handleSmileWebhook(payload, 'valid-sig');

      const status = await service.getKycStatus('user-5');
      expect(status.currentTier).toBe(1);
    });

    it('upgrades user tier to 2 on successful Tier 2 (liveness) verification', async () => {
      await service.submitKyc('user-6', 2, 'passport', Buffer.from('selfie'));

      const payload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: { Verify_ID_Number: 'Verified', Liveness_Check: 'Passed' },
      };
      await service.handleSmileWebhook(payload, 'valid-sig');

      const status = await service.getKycStatus('user-6');
      expect(status.currentTier).toBe(2);
    });

    it('does not upgrade tier on failed verification', async () => {
      await service.submitKyc('user-7', 1, 'national_id', Buffer.from('img'));

      const payload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0820',
        ResultText: 'ID Not Verified',
        Actions: { Verify_ID_Number: 'Not Verified' },
      };
      await service.handleSmileWebhook(payload, 'valid-sig');

      const status = await service.getKycStatus('user-7');
      expect(status.currentTier).toBe(0);
    });

    it('ignores webhook for unknown SmileJobID', async () => {
      const payload = {
        SmileJobID: 'unknown-job-xyz',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: {},
      };

      const result = await service.handleSmileWebhook(payload, 'valid-sig');
      expect(result.received).toBe(true); // ACK but no state change
    });

    it('handles duplicate approved webhooks idempotently', async () => {
      await service.submitKyc('user-8', 1, 'national_id', Buffer.from('img'));

      const payload = {
        SmileJobID: 'smile-job-001',
        ResultCode: '0810',
        ResultText: 'Enrol User',
        Actions: { Verify_ID_Number: 'Verified' },
      };
      await service.handleSmileWebhook(payload, 'valid-sig');
      await service.handleSmileWebhook(payload, 'valid-sig');

      const status = await service.getKycStatus('user-8');
      expect(status.currentTier).toBe(1); // still 1, not doubled
    });
  });
});

// ─── SmileIdentityAdapter unit tests ─────────────────────────────────────────

describe('SmileIdentityAdapter (concrete implementation)', () => {
  describe('verifyWebhookSignature', () => {
    it('returns true for correct HMAC-SHA256 signature', () => {
      const secret = 'test-webhook-secret';
      const body = JSON.stringify({ SmileJobID: 'job-1', ResultCode: '0810' });
      const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

      const adapter = new DefaultSmileIdentityAdapter({ apiKey: 'key', partnerId: 'pid', apiUrl: 'http://api', webhookSecret: secret });
      expect(adapter.verifyWebhookSignature(body, expectedSig)).toBe(true);
    });

    it('returns false for incorrect signature', () => {
      const adapter = new DefaultSmileIdentityAdapter({ apiKey: 'key', partnerId: 'pid', apiUrl: 'http://api', webhookSecret: 'secret' });
      expect(adapter.verifyWebhookSignature('{"SmileJobID":"job-1"}', 'wrong-sig')).toBe(false);
    });

    it('returns false for empty signature', () => {
      const adapter = new DefaultSmileIdentityAdapter({ apiKey: 'key', partnerId: 'pid', apiUrl: 'http://api', webhookSecret: 'secret' });
      expect(adapter.verifyWebhookSignature('body', '')).toBe(false);
    });

    it('uses timing-safe comparison to prevent timing attacks', () => {
      // If the signature lengths differ it should return false without throwing
      const adapter = new DefaultSmileIdentityAdapter({ apiKey: 'key', partnerId: 'pid', apiUrl: 'http://api', webhookSecret: 'secret' });
      expect(adapter.verifyWebhookSignature('body', 'short')).toBe(false);
    });
  });

  describe('submitJob', () => {
    let adapter: DefaultSmileIdentityAdapter;

    beforeEach(() => {
      adapter = new DefaultSmileIdentityAdapter({
        apiKey: 'test-key',
        partnerId: 'test-partner',
        apiUrl: 'http://mock-api',
        webhookSecret: 'secret',
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('submits job and returns smileJobId from API response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          smile_job_id: 'smile-abc-123',
          result: {
            ResultCode: '0810',
            ResultText: 'Enrol User',
            Actions: { Verify_ID_Number: 'Verified' },
          },
        }),
      }) as unknown as typeof fetch;

      const result = await adapter.submitJob({
        userId: 'user-1',
        tier: 1,
        documentType: 'national_id',
        imageBase64: 'base64data',
      });

      expect(result.smileJobId).toBe('smile-abc-123');
      expect(result.resultCode).toBe('0810');
      expect(result.resultText).toBe('Enrol User');
    });

    it('calls the correct Smile Identity submission endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ smile_job_id: 'j1', result: {} }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await adapter.submitJob({ userId: 'u', tier: 1, documentType: 'national_id', imageBase64: 'b64' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/smile_identity_services/v1/submission'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on non-ok API response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }) as unknown as typeof fetch;

      await expect(
        adapter.submitJob({ userId: 'u', tier: 1, documentType: 'passport', imageBase64: 'b64' }),
      ).rejects.toThrow(/500/);
    });

    it('uses passport image type id 0 for passport documents', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ smile_job_id: 'j-pass', result: {} }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await adapter.submitJob({ userId: 'u', tier: 1, documentType: 'passport', imageBase64: 'b64' });

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.images[0].image_type_id).toBe(0);
    });

    it('uses image type id 1 for national_id documents', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ smile_job_id: 'j-nid', result: {} }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await adapter.submitJob({ userId: 'u', tier: 1, documentType: 'national_id', imageBase64: 'b64' });

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.images[0].image_type_id).toBe(1);
    });

    it('falls back to generated job id when API response lacks smile_job_id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ result: { ResultCode: '0810', ResultText: 'OK' } }),
      }) as unknown as typeof fetch;

      const result = await adapter.submitJob({ userId: 'u', tier: 1, documentType: 'passport', imageBase64: 'b64' });

      expect(result.smileJobId).toContain('test-partner');
    });
  });

  describe('getJobStatus', () => {
    let adapter: DefaultSmileIdentityAdapter;

    beforeEach(() => {
      adapter = new DefaultSmileIdentityAdapter({
        apiKey: 'key', partnerId: 'pid', apiUrl: 'http://api', webhookSecret: 'secret',
      });
    });

    it('returns job status from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          smile_job_id: 'job-1',
          job_complete: true,
          result: { ResultCode: '0810', ResultText: 'Enrol User' },
        }),
      }) as unknown as typeof fetch;

      const result = await adapter.getJobStatus('job-1');

      expect(result.smileJobId).toBe('job-1');
      expect(result.complete).toBe(true);
      expect(result.resultCode).toBe('0810');
    });

    it('returns complete: false when job is pending', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          smile_job_id: 'job-pending',
          job_complete: false,
          result: null,
        }),
      }) as unknown as typeof fetch;

      const result = await adapter.getJobStatus('job-pending');
      expect(result.complete).toBe(false);
    });

    it('throws on API failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof fetch;

      await expect(adapter.getJobStatus('unknown-job')).rejects.toThrow(/404/);
    });
  });

  describe('createSmileIdentityAdapter factory', () => {
    it('creates an adapter instance with env var config', () => {
      const { createSmileIdentityAdapter } = require('@/server/adapters/smileIdentityAdapter');
      const instance = createSmileIdentityAdapter();
      expect(instance).toBeInstanceOf(DefaultSmileIdentityAdapter);
    });

    it('uses SMILE_IDENTITY_API_URL env var when set', () => {
      process.env['SMILE_IDENTITY_API_URL'] = 'https://custom.api.url';
      const { createSmileIdentityAdapter } = require('@/server/adapters/smileIdentityAdapter');
      const instance = createSmileIdentityAdapter();
      expect(instance).toBeInstanceOf(DefaultSmileIdentityAdapter);
      delete process.env['SMILE_IDENTITY_API_URL'];
    });
  });
});

// ─── KYC route tests (POST /submit, GET /status, POST /webhook/smile-identity) ──

describe('KYC Smile Identity routes', () => {
  let testApp: express.Application;
  let mockSmileService: SmileIdentityKycService;

  beforeEach(() => {
    const adapter = makeAdapter();
    mockSmileService = new SmileIdentityKycService(adapter);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/v1/kyc', createKycSmileRouter(mockSmileService));
  });

  describe('POST /v1/kyc/submit', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .send({ tier: 1, documentType: 'national_id' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when tier is missing', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .set('Authorization', 'Bearer test-token')
        .send({ documentType: 'national_id' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/tier/i);
    });

    it('returns 400 when documentType is missing', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .set('Authorization', 'Bearer test-token')
        .send({ tier: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/documentType/i);
    });

    it('returns 400 for invalid tier value', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .set('Authorization', 'Bearer test-token')
        .send({ tier: 99, documentType: 'national_id' });

      expect(res.status).toBe(400);
    });

    it('returns 200 with submission result on valid request', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .set('Authorization', 'Bearer test-token')
        .send({ tier: 1, documentType: 'national_id' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'pending');
    });

    it('accepts passport and driver_license document types', async () => {
      for (const docType of ['passport', 'driver_license']) {
        const res = await request(testApp)
          .post('/v1/kyc/submit')
          .set('Authorization', 'Bearer test-token')
          .send({ tier: 1, documentType: docType });

        expect(res.status).toBe(200);
      }
    });

    it('returns 400 for invalid documentType', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/submit')
        .set('Authorization', 'Bearer test-token')
        .send({ tier: 1, documentType: 'birth_certificate' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/kyc/status', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(testApp).get('/v1/kyc/status');
      expect(res.status).toBe(401);
    });

    it('returns current KYC status for authenticated user', async () => {
      const res = await request(testApp)
        .get('/v1/kyc/status')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('currentTier');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('userId');
    });

    it('returns tier 0 and status none for new user', async () => {
      const res = await request(testApp)
        .get('/v1/kyc/status')
        .set('Authorization', 'Bearer fresh-user-token');

      expect(res.body.data.currentTier).toBe(0);
      expect(res.body.data.status).toBe('none');
    });
  });

  describe('POST /v1/kyc/webhook/smile-identity', () => {
    it('returns 400 for missing signature header', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/webhook/smile-identity')
        .send({ SmileJobID: 'job-1' });

      expect(res.status).toBe(400);
    });

    it('returns 200 for valid webhook with signature header', async () => {
      const res = await request(testApp)
        .post('/v1/kyc/webhook/smile-identity')
        .set('x-smile-signature', 'valid-hmac-sig')
        .send({ SmileJobID: 'job-1', ResultCode: '0810' });

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);
    });

    it('returns 401 when service throws invalid signature error', async () => {
      jest.spyOn(mockSmileService, 'handleSmileWebhook').mockRejectedValueOnce(
        new Error('Invalid webhook signature'),
      );

      // Rebuild app with the spied service
      const spyApp = express();
      spyApp.use(express.json());
      spyApp.use('/v1/kyc', createKycSmileRouter(mockSmileService));

      const res = await request(spyApp)
        .post('/v1/kyc/webhook/smile-identity')
        .set('x-smile-signature', 'bad-sig')
        .send({ SmileJobID: 'job-1' });

      expect(res.status).toBe(401);
    });
  });
});
