import { Router } from 'express';
import multer from 'multer';
import type { IKycService } from '../services/kycService';
import { ok, badRequest } from '../middleware/errorHandler';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createKycRouter(kycService: IKycService): Router {
  const router = Router();

  // POST /kyc/sessions
  router.post('/sessions', async (_req, res, next) => {
    try {
      const result = await kycService.createSession();
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /kyc/sessions/current
  router.get('/sessions/current', async (_req, res, next) => {
    try {
      const result = await kycService.getSession();
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/sessions/:sessionId/documents
  router.post('/sessions/:sessionId/documents', upload.single('document'), async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { documentType, side } = req.body as Record<string, unknown>;

      if (!req.file) return badRequest(res, 'document file is required');
      if (!documentType || typeof documentType !== 'string') return badRequest(res, 'documentType is required');
      if (!side || typeof side !== 'string') return badRequest(res, 'side is required');

      const result = await kycService.uploadDocument(
        sessionId,
        req.file.buffer,
        documentType as 'passport' | 'national_id' | 'driver_license',
        side as 'front' | 'back',
      );
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/sessions/:sessionId/selfie
  router.post('/sessions/:sessionId/selfie', upload.single('selfie'), async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      if (!req.file) return badRequest(res, 'selfie file is required');

      const result = await kycService.uploadSelfie(sessionId, req.file.buffer);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/sessions/:sessionId/address
  router.post('/sessions/:sessionId/address', upload.single('document'), async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      if (!req.file) return badRequest(res, 'document file is required');

      const result = await kycService.uploadAddressProof(sessionId, req.file.buffer, req.file.mimetype);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/sessions/:sessionId/liveness-token
  router.post('/sessions/:sessionId/liveness-token', async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const result = await kycService.getLivenessToken(sessionId);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/sessions/:sessionId/submit
  router.post('/sessions/:sessionId/submit', async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const result = await kycService.submitSession(sessionId);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/veriff/sessions
  router.post('/veriff/sessions', async (req, res, next) => {
    try {
      const { vendorData, countryCode, documentType } = req.body as Record<string, unknown>;
      if (!vendorData || typeof vendorData !== 'string') return badRequest(res, 'vendorData is required');
      if (!countryCode || typeof countryCode !== 'string') return badRequest(res, 'countryCode is required');

      const result = await kycService.createVeriffSession({
        vendorData,
        countryCode,
        documentType: typeof documentType === 'string' ? documentType : undefined,
      });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /kyc/veriff/sessions/:sessionId/decision
  router.get('/veriff/sessions/:sessionId/decision', async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const result = await kycService.getVeriffDecision(sessionId);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /kyc/webhook — Veriff webhook
  router.post('/webhook', async (req, res, next) => {
    try {
      const signature = (req.headers['x-hmac-signature'] as string) ?? '';
      const result = await kycService.handleVeriffWebhook(req.body, signature);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
