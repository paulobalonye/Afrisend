/**
 * KYC Smile Identity routes.
 *
 * POST /kyc/submit               — initiate a KYC submission
 * GET  /kyc/status               — get current KYC status for authenticated user
 * POST /kyc/webhook/smile-identity — receive async Smile Identity callbacks
 */

import { Router } from 'express';
import type { SmileIdentityKycService } from '../services/smileIdentityKycService';
import type { DocumentType } from '../adapters/smileIdentityAdapter';
import { ok, badRequest } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const VALID_DOCUMENT_TYPES = new Set<DocumentType>(['national_id', 'passport', 'driver_license']);
const VALID_TIERS = new Set([1, 2, 3]);

export function createKycSmileRouter(service: SmileIdentityKycService): Router {
  const router = Router();

  // ── POST /kyc/submit ────────────────────────────────────────────────────

  router.post('/submit', requireAuth, async (req, res, next) => {
    try {
      const { tier, documentType } = req.body as Record<string, unknown>;

      if (tier === undefined || tier === null) {
        return badRequest(res, 'tier is required');
      }

      const tierNum = Number(tier);
      if (!VALID_TIERS.has(tierNum)) {
        return badRequest(res, 'tier must be 1, 2, or 3');
      }

      if (!documentType || typeof documentType !== 'string') {
        return badRequest(res, 'documentType is required');
      }

      if (!VALID_DOCUMENT_TYPES.has(documentType as DocumentType)) {
        return badRequest(res, `documentType must be one of: ${[...VALID_DOCUMENT_TYPES].join(', ')}`);
      }

      const userId = req.userId!;

      // In production, receive image via multipart. For the sandbox, accept
      // a base64-encoded image string in the request body or use a 1-byte stub.
      const imageData = typeof req.body['imageBase64'] === 'string'
        ? Buffer.from(req.body['imageBase64'] as string, 'base64')
        : Buffer.from('stub');

      const submission = await service.submitKyc(
        userId,
        tierNum,
        documentType as DocumentType,
        imageData,
      );

      return ok(res, submission);
    } catch (err) {
      return next(err);
    }
  });

  // ── GET /kyc/status ─────────────────────────────────────────────────────

  router.get('/status', requireAuth, async (req, res, next) => {
    try {
      const userId = req.userId!;
      const status = await service.getKycStatus(userId);
      return ok(res, status);
    } catch (err) {
      return next(err);
    }
  });

  // ── POST /kyc/webhook/smile-identity ────────────────────────────────────

  router.post('/webhook/smile-identity', async (req, res, next) => {
    try {
      const signature = req.headers['x-smile-signature'];

      if (!signature || typeof signature !== 'string') {
        return badRequest(res, 'x-smile-signature header is required');
      }

      const result = await service.handleSmileWebhook(req.body, signature);
      return ok(res, result);
    } catch (err) {
      if (err instanceof Error && /invalid.*signature/i.test(err.message)) {
        res.status(401).json({ success: false, data: null, error: err.message });
        return;
      }
      return next(err);
    }
  });

  return router;
}
