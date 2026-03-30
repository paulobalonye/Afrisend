/**
 * Transaction routes — send money flow.
 *
 * POST   /transactions         — initiate a new send
 * GET    /transactions/:id     — get transaction status
 * GET    /transactions         — list user transactions (paginated)
 * POST   /transactions/:id/cancel — cancel if still pending
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { ITransactionService } from '../services/transactionService';
import { ok, badRequest, notFound } from '../middleware/errorHandler';

function conflict(res: Response, message: string): void {
  res.status(409).json({ success: false, data: null, error: message });
}

export function createTransactionRouter(transactionService: ITransactionService): Router {
  const router = Router();

  // POST /transactions — initiate a new send
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const body = req.body as Record<string, unknown>;
      const {
        idempotencyKey,
        recipientId,
        amount,
        currency,
        targetAmount,
        targetCurrency,
        fxRate,
        payoutRail,
        quoteId,
        corridorId,
      } = body;

      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return badRequest(res, 'idempotencyKey is required');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return badRequest(res, 'amount must be a positive number');
      }
      if (!currency || typeof currency !== 'string') {
        return badRequest(res, 'currency is required');
      }
      if (typeof targetAmount !== 'number' || targetAmount <= 0) {
        return badRequest(res, 'targetAmount must be a positive number');
      }
      if (!targetCurrency || typeof targetCurrency !== 'string') {
        return badRequest(res, 'targetCurrency is required');
      }
      if (typeof fxRate !== 'number' || fxRate <= 0) {
        return badRequest(res, 'fxRate must be a positive number');
      }

      const tx = await transactionService.initiate({
        userId,
        recipientId: typeof recipientId === 'string' ? recipientId : null,
        idempotencyKey,
        amount,
        currency,
        targetAmount,
        targetCurrency,
        fxRate,
        payoutRail: typeof payoutRail === 'string' ? payoutRail : null,
        quoteId: typeof quoteId === 'string' ? quoteId : null,
        corridorId: typeof corridorId === 'string' ? corridorId : null,
      });

      res.status(201).json({ success: true, data: tx, error: null });
    } catch (err) {
      return next(err);
    }
  });

  // GET /transactions/:id — get transaction status
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const { id } = req.params as { id: string };

      try {
        const tx = await transactionService.get(id, userId);
        return ok(res, tx);
      } catch (err) {
        if (err instanceof Error && /not found/i.test(err.message)) {
          return notFound(res, err.message);
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  // GET /transactions — list user transactions with pagination
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

      const result = await transactionService.list(userId, { page, limit });

      res.status(200).json({
        success: true,
        data: result.data,
        error: null,
        meta: {
          total: result.total,
          page:  result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /transactions/:id/cancel — cancel if still pending
  router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) return badRequest(res, 'Unauthorized');

      const { id } = req.params as { id: string };

      try {
        const tx = await transactionService.cancel(id, userId);
        return ok(res, tx);
      } catch (err) {
        if (err instanceof Error) {
          if (/not found/i.test(err.message)) {
            return notFound(res, err.message);
          }
          if (/cannot cancel/i.test(err.message)) {
            return conflict(res, err.message);
          }
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
