/**
 * FX routes.
 *
 * GET  /fx/rates           — current rates for all corridors (public)
 * POST /fx/quote           — generate a 15-minute locked quote
 * POST /fx/quote/:id/lock  — atomically lock a quote for a transaction
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { IFxRateService } from '../services/fxRateService';
import { ok, badRequest, notFound, serverError } from '../middleware/errorHandler';

function conflict(res: Response, message: string): void {
  res.status(409).json({ success: false, data: null, error: message });
}

function gone(res: Response, message: string): void {
  res.status(410).json({ success: false, data: null, error: message });
}

const VALID_DIRECTIONS = new Set(['send', 'receive']);

export function createFxRouter(fxService: IFxRateService): Router {
  const router = Router();

  // GET /fx/rates — current rates for all corridors
  router.get('/rates', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rates = await fxService.getCurrentRates();
      ok(res, rates);
    } catch (err) {
      next(err);
    }
  });

  // POST /fx/quote — generate a 15-minute locked quote
  router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { from_currency, to_currency, amount, direction } = body;

      if (!from_currency || typeof from_currency !== 'string') {
        return badRequest(res, 'from_currency is required');
      }
      if (!to_currency || typeof to_currency !== 'string') {
        return badRequest(res, 'to_currency is required');
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return badRequest(res, 'amount must be a positive number');
      }
      if (!direction || typeof direction !== 'string' || !VALID_DIRECTIONS.has(direction)) {
        return badRequest(res, 'direction must be "send" or "receive"');
      }

      let quote;
      try {
        quote = await fxService.createQuote({
          fromCurrency: from_currency,
          toCurrency: to_currency,
          amount: amount as number,
          direction: direction as 'send' | 'receive',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create quote';
        if (/unsupported corridor/i.test(message) || /no rate available/i.test(message)) {
          return badRequest(res, message);
        }
        return next(err);
      }

      res.status(201).json({ success: true, data: quote, error: null });
    } catch (err) {
      next(err);
    }
  });

  // POST /fx/quote/:id/lock — validate and atomically lock a quote
  router.post('/quote/:id/lock', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      let quote;
      try {
        quote = await fxService.validateAndLockQuote(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to lock quote';
        if (/not found/i.test(message)) return notFound(res, message);
        if (/already used/i.test(message)) return conflict(res, message);
        if (/expired/i.test(message)) return gone(res, message);
        return next(err);
      }

      ok(res, quote);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
