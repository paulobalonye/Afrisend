import { Router } from 'express';
import type { IRemittanceService } from '../services/remittanceService';
import type { Recipient } from '@afrisend/shared';
import { ok, badRequest } from '../middleware/errorHandler';

export function createRemittanceRouter(remittanceService: IRemittanceService): Router {
  const router = Router();

  // GET /remittance/corridors
  router.get('/corridors', async (_req, res, next) => {
    try {
      const result = await remittanceService.listCorridors();
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /remittance/v2/rates?corridorId=...&sourceAmount=...
  router.get('/v2/rates', async (req, res, next) => {
    try {
      const { corridorId, sourceAmount, refreshIntervalSeconds } = req.query as Record<string, string | undefined>;

      if (!corridorId) return badRequest(res, 'corridorId query param is required');
      if (!sourceAmount) return badRequest(res, 'sourceAmount query param is required');

      const amount = Number(sourceAmount);
      if (isNaN(amount) || amount <= 0) return badRequest(res, 'sourceAmount must be a positive number');

      const result = await remittanceService.getRates({
        corridorId,
        sourceAmount: amount,
        refreshIntervalSeconds: refreshIntervalSeconds ? Number(refreshIntervalSeconds) : undefined,
      });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /remittance/payments
  router.post('/payments', async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const { idempotencyKey, quoteId, corridorId, sourceCurrency, sourceAmount, recipient, senderNote } = body;

      if (!idempotencyKey || typeof idempotencyKey !== 'string') return badRequest(res, 'idempotencyKey is required');
      if (!quoteId || typeof quoteId !== 'string') return badRequest(res, 'quoteId is required');
      if (!corridorId || typeof corridorId !== 'string') return badRequest(res, 'corridorId is required');
      if (!sourceCurrency || sourceCurrency !== 'USDC') return badRequest(res, 'sourceCurrency must be USDC');
      if (typeof sourceAmount !== 'number' || sourceAmount <= 0) return badRequest(res, 'sourceAmount must be a positive number');
      if (!recipient || typeof recipient !== 'object') return badRequest(res, 'recipient is required');

      const result = await remittanceService.initiatePayment({
        idempotencyKey,
        quoteId,
        corridorId,
        sourceCurrency: 'USDC',
        sourceAmount,
        recipient: recipient as Recipient,
        senderNote: typeof senderNote === 'string' ? senderNote : undefined,
      });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /remittance/payments/:id
  router.get('/payments/:id', async (req, res, next) => {
    try {
      const result = await remittanceService.getPaymentStatus(req.params.id);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // GET /remittance/payments/:id/settlement
  router.get('/payments/:id/settlement', async (req, res, next) => {
    try {
      const result = await remittanceService.getSettlement(req.params.id);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
