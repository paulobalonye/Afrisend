/**
 * Fraud Detection routes.
 *
 * POST   /fraud/assess                        — assess a transaction for fraud risk
 * GET    /fraud/decisions/:transactionId      — get fraud decision for a transaction
 * GET    /fraud/devices/:deviceId             — get device trust info
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { IFraudDetectionService } from '../services/fraudDetectionService';
import { ok, badRequest, notFound } from '../middleware/errorHandler';

export function createFraudDetectionRouter(fraudService: IFraudDetectionService): Router {
  const router = Router();

  // POST /fraud/assess — pre-authorization fraud assessment
  router.post('/assess', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const body = req.body as Record<string, unknown>;
      const { transactionId, amount, currency, recipientId, corridorId, deviceId, ipAddress, userAgent, hour } = body;

      if (!transactionId || typeof transactionId !== 'string') {
        return badRequest(res, 'transactionId is required');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return badRequest(res, 'amount must be a positive number');
      }
      if (!currency || typeof currency !== 'string') {
        return badRequest(res, 'currency is required');
      }
      if (!deviceId || typeof deviceId !== 'string') {
        return badRequest(res, 'deviceId is required');
      }
      if (!ipAddress || typeof ipAddress !== 'string') {
        return badRequest(res, 'ipAddress is required');
      }

      const hourValue = typeof hour === 'number' ? hour : new Date().getUTCHours();

      const result = await fraudService.assess({
        transactionId,
        userId,
        amount,
        currency,
        recipientId: typeof recipientId === 'string' ? recipientId : null,
        corridorId: typeof corridorId === 'string' ? corridorId : null,
        deviceId,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        hour: hourValue,
      });

      return ok(res, result);
    } catch (err) {
      next(err);
    }
  });

  // GET /fraud/decisions/:transactionId — get stored fraud decision
  router.get('/decisions/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactionId = req.params['transactionId'] as string;
      const decision = await fraudService.getDecision(transactionId);
      if (!decision) {
        return notFound(res, `No fraud decision found for transaction: ${transactionId}`);
      }
      return ok(res, decision);
    } catch (err) {
      next(err);
    }
  });

  // GET /fraud/devices/:deviceId — get device trust info
  router.get('/devices/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.params['deviceId'] as string;
      const trust = await fraudService.getDeviceTrust(deviceId);
      if (!trust) {
        return notFound(res, `No device trust info found for device: ${deviceId}`);
      }
      return ok(res, trust);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
