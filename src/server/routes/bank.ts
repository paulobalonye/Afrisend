import { Router } from 'express';
import type { IRemittanceService } from '../services/remittanceService';
import { ok, badRequest } from '../middleware/errorHandler';

export function createBankRouter(remittanceService: IRemittanceService): Router {
  const router = Router();

  // POST /bank/verify
  router.post('/verify', async (req, res, next) => {
    try {
      const { accountNumber, bankCode } = req.body as Record<string, unknown>;
      if (!accountNumber || typeof accountNumber !== 'string') return badRequest(res, 'accountNumber is required');
      if (!bankCode || typeof bankCode !== 'string') return badRequest(res, 'bankCode is required');

      const result = await remittanceService.verifyBankAccount(accountNumber, bankCode);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
