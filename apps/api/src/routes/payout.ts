/**
 * Payout routes
 *
 * POST /v1/payout/route        — Initiate a payout (internal / service-to-service)
 * POST /v1/payout/webhook      — Generic provider status webhook
 */

import { Router } from 'express';
import { z } from 'zod';
import type { IPayoutRoutingService } from '../services/payoutRoutingService';
import { ok, badRequest } from '../middleware/errorHandler';

const payoutRequestSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  destinationCountry: z.string().min(2).max(2),
  method: z.enum(['mobile_money', 'bank_transfer']),
  recipient: z.object({
    name: z.string().min(1),
    accountNumber: z.string().nullable(),
    bankCode: z.string().nullable(),
    phoneNumber: z.string().nullable(),
  }),
});

const statusUpdateSchema = z.object({
  transactionId: z.string().min(1),
  providerRef: z.string().min(1),
  provider: z.string().min(1),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  failureReason: z.string().optional(),
});

export function createPayoutRouter(payoutRoutingService: IPayoutRoutingService): Router {
  const router = Router();

  // POST /v1/payout/route
  router.post('/route', async (req, res, next) => {
    try {
      const parsed = payoutRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.message);
      }
      const result = await payoutRoutingService.route(parsed.data);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /v1/payout/webhook
  router.post('/webhook', async (req, res, next) => {
    try {
      const parsed = statusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return badRequest(res, parsed.error.message);
      }
      await payoutRoutingService.handleStatusUpdate(parsed.data);
      return ok(res, { received: true });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
