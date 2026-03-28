/**
 * Admin routes — /v1/admin/*
 *
 * Mount behind requireAdmin middleware. All routes require a valid admin JWT.
 *
 * GET    /admin/transactions                 — list all transactions (filter by status, userId)
 * GET    /admin/transactions/:id             — get transaction by id
 * POST   /admin/transactions/:id/override    — override transaction status
 * GET    /admin/users                        — list all users (filter by kycStatus)
 * PATCH  /admin/users/:id                   — update KYC tier / account status
 * GET    /admin/fx/corridors                 — list corridors with markup
 * PATCH  /admin/fx/corridors/:id            — update corridor markup
 * GET    /admin/compliance                   — list flagged transactions
 * GET    /admin/metrics/corridors            — corridor performance metrics
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { IAdminService } from '../services/adminService';
import type { AccountStatus } from '../services/adminService';
import { TransactionStatus } from '../services/transactionService';
import { ok, badRequest, notFound } from '../middleware/errorHandler';

const VALID_ACCOUNT_STATUSES = new Set<AccountStatus>(['active', 'suspended', 'closed']);
const VALID_TRANSACTION_STATUSES = new Set<string>(Object.values(TransactionStatus));

export function createAdminRouter(adminService: IAdminService): Router {
  const router = Router();

  // ── GET /admin/transactions ───────────────────────────────────────────────

  router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

      const result = await adminService.listTransactions({ status, userId, page, limit });

      res.status(200).json({
        success: true,
        data: result.data,
        error: null,
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    } catch (err) {
      return next(err);
    }
  });

  // ── GET /admin/transactions/:id ───────────────────────────────────────────

  router.get('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      try {
        const tx = await adminService.getTransaction(String(req.params.id));
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

  // ── POST /admin/transactions/:id/override ─────────────────────────────────

  router.post('/transactions/:id/override', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, reason } = req.body as Record<string, unknown>;

      if (!status || typeof status !== 'string') {
        return badRequest(res, 'status is required');
      }
      if (!VALID_TRANSACTION_STATUSES.has(status)) {
        return badRequest(res, `status must be one of: ${[...VALID_TRANSACTION_STATUSES].join(', ')}`);
      }
      if (!reason || typeof reason !== 'string') {
        return badRequest(res, 'reason is required');
      }

      try {
        const updated = await adminService.overrideTransactionStatus(
          String(req.params.id),
          status as TransactionStatus,
          reason,
          req.userId!,
        );
        return ok(res, updated);
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

  // ── GET /admin/users ──────────────────────────────────────────────────────

  router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const kycStatus = typeof req.query.kycStatus === 'string' ? req.query.kycStatus : undefined;
      const accountStatus = typeof req.query.accountStatus === 'string'
        ? (req.query.accountStatus as AccountStatus)
        : undefined;

      const result = await adminService.listUsers({ kycStatus, accountStatus, page, limit });

      res.status(200).json({
        success: true,
        data: result.data,
        error: null,
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    } catch (err) {
      return next(err);
    }
  });

  // ── PATCH /admin/users/:id ────────────────────────────────────────────────

  router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { kycTier, accountStatus, transactionLimit } = req.body as Record<string, unknown>;

      if (accountStatus !== undefined) {
        if (typeof accountStatus !== 'string' || !VALID_ACCOUNT_STATUSES.has(accountStatus as AccountStatus)) {
          return badRequest(res, `accountStatus must be one of: ${[...VALID_ACCOUNT_STATUSES].join(', ')}`);
        }
      }
      if (kycTier !== undefined && (typeof kycTier !== 'number' || !Number.isInteger(kycTier) || kycTier < 0 || kycTier > 3)) {
        return badRequest(res, 'kycTier must be an integer between 0 and 3');
      }
      if (transactionLimit !== undefined && (typeof transactionLimit !== 'number' || transactionLimit < 0)) {
        return badRequest(res, 'transactionLimit must be a non-negative number');
      }

      try {
        const updated = await adminService.updateUser(String(req.params.id), {
          kycTier: typeof kycTier === 'number' ? kycTier : undefined,
          accountStatus: typeof accountStatus === 'string' ? (accountStatus as AccountStatus) : undefined,
          transactionLimit: typeof transactionLimit === 'number' ? transactionLimit : undefined,
        });
        return ok(res, updated);
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

  // ── GET /admin/fx/corridors ───────────────────────────────────────────────

  router.get('/fx/corridors', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const corridors = await adminService.listFxCorridors();
      return ok(res, corridors);
    } catch (err) {
      return next(err);
    }
  });

  // ── PATCH /admin/fx/corridors/:id ─────────────────────────────────────────

  router.patch('/fx/corridors/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { markupBps } = req.body as Record<string, unknown>;

      if (typeof markupBps !== 'number' || !isFinite(markupBps) || markupBps < 0) {
        return badRequest(res, 'markupBps must be a non-negative number');
      }

      try {
        const updated = await adminService.updateCorridorMarkup(String(req.params.id), markupBps);
        return ok(res, updated);
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

  // ── GET /admin/compliance ─────────────────────────────────────────────────

  router.get('/compliance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const flagType = typeof req.query.flagType === 'string' ? req.query.flagType : undefined;

      const result = await adminService.listFlaggedTransactions({
        flagType: flagType as Parameters<IAdminService['listFlaggedTransactions']>[0]['flagType'],
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        error: null,
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    } catch (err) {
      return next(err);
    }
  });

  // ── GET /admin/metrics/corridors ──────────────────────────────────────────

  router.get('/metrics/corridors', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await adminService.getCorridorMetrics();
      return ok(res, metrics);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
