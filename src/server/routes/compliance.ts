/**
 * Compliance routes — AML screening, sanctions checks, and transaction limits.
 *
 * POST   /compliance/check              — pre-transaction compliance check
 * GET    /compliance/limits/:userId     — get current usage and limits for user
 * POST   /compliance/flag/:transactionId — manual flag for review
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { IComplianceService } from '../services/complianceService';
import { ok, badRequest } from '../middleware/errorHandler';

export function createComplianceRouter(complianceService: IComplianceService): Router {
  const router = Router();

  // POST /compliance/check — pre-transaction compliance check
  router.post('/check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const body = req.body as Record<string, unknown>;
      const { transactionId, amount, currency, senderName, recipientName, corridorId, kycTier } = body;

      if (!transactionId || typeof transactionId !== 'string') {
        return badRequest(res, 'transactionId is required');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return badRequest(res, 'amount must be a positive number');
      }
      if (!currency || typeof currency !== 'string') {
        return badRequest(res, 'currency is required');
      }
      if (!senderName || typeof senderName !== 'string') {
        return badRequest(res, 'senderName is required');
      }
      if (!recipientName || typeof recipientName !== 'string') {
        return badRequest(res, 'recipientName is required');
      }
      if (kycTier === undefined || kycTier === null || typeof kycTier !== 'number') {
        return badRequest(res, 'kycTier is required');
      }

      const result = await complianceService.check({
        transactionId,
        userId,
        amount,
        currency,
        senderName,
        recipientName,
        corridorId: typeof corridorId === 'string' ? corridorId : null,
        kycTier,
      });

      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /compliance/limits/:userId — get current usage and limits for user
  router.get('/limits/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestingUserId = req.userId;
      if (!requestingUserId) return badRequest(res, 'Unauthorized');

      const { userId } = req.params;

      // Derive kycTier from query param (default 1 if not provided — lookup from user service in production)
      const tierParam = req.query.kycTier;
      const kycTier = tierParam !== undefined ? Number(tierParam) : 1;

      const limits = await complianceService.getLimits(userId, kycTier);
      return ok(res, limits);
    } catch (err) {
      return next(err);
    }
  });

  // POST /compliance/flag/:transactionId — manual flag for review
  router.post('/flag/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const { transactionId } = req.params;
      const body = req.body as Record<string, unknown>;
      const { reason } = body;

      if (!reason || typeof reason !== 'string') {
        return badRequest(res, 'reason is required');
      }

      const flag = await complianceService.flagForReview(transactionId, reason);
      return ok(res, flag);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
