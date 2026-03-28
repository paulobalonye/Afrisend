import { Router } from 'express';
import type { IRemittanceService } from '../services/remittanceService';
import { ok } from '../middleware/errorHandler';

export function createWebhooksRouter(remittanceService: IRemittanceService): Router {
  const router = Router();

  // POST /payment/webhook/flutterwave
  router.post('/webhook/flutterwave', async (req, res, next) => {
    try {
      const hash = (req.headers['verif-hash'] as string) ?? '';
      const result = await remittanceService.handleFlutterwaveWebhook(req.body, hash);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /payment/webhook/yellowcard
  router.post('/webhook/yellowcard', async (req, res, next) => {
    try {
      const signature = (req.headers['x-yellowcard-signature'] as string) ?? '';
      const result = await remittanceService.handleYellowCardWebhook(req.body, signature);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
