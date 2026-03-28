import { Router } from 'express';
import type { IAuthService } from '../services/authService';
import type { IUserService } from '../services/userService';
import { ok, badRequest, notFound } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const VALID_PAYOUT_METHODS = new Set(['mobile_money', 'bank_transfer']);
const VALID_PURPOSES = new Set(['family', 'business', 'savings', 'education', 'other']);

export function createUsersRouter(authService: IAuthService, userService: IUserService): Router {
  const router = Router();

  // ── Legacy profile setup (kept for backwards compat) ──────────────────────
  // POST /v1/users/me/profile
  router.post('/me/profile', async (req, res, next) => {
    try {
      const { dateOfBirth, nationality, residenceCountry, purpose } = req.body as Record<string, unknown>;
      if (!dateOfBirth || typeof dateOfBirth !== 'string') return badRequest(res, 'dateOfBirth is required');
      if (!nationality || typeof nationality !== 'string') return badRequest(res, 'nationality is required');
      if (!residenceCountry || typeof residenceCountry !== 'string') return badRequest(res, 'residenceCountry is required');
      if (!purpose || typeof purpose !== 'string') return badRequest(res, 'purpose is required');
      if (!VALID_PURPOSES.has(purpose)) return badRequest(res, `purpose must be one of: ${[...VALID_PURPOSES].join(', ')}`);

      const authHeader = req.headers.authorization;
      const userId = authHeader ? `user-from-token` : 'anonymous';

      const result = await authService.setupProfile(userId, {
        dateOfBirth,
        nationality,
        residenceCountry,
        purpose: purpose as 'family' | 'business' | 'savings' | 'education' | 'other',
      });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // ── User profile ──────────────────────────────────────────────────────────

  // GET /v1/users/me
  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const profile = await userService.getProfile(req.userId!);
      return ok(res, profile);
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /v1/users/me
  router.patch('/me', requireAuth, async (req, res, next) => {
    try {
      const { displayName, residenceCountry, preferredCurrency, notificationPreferences } =
        req.body as Record<string, unknown>;

      const input: Parameters<IUserService['updateProfile']>[1] = {};
      if (displayName !== undefined) {
        if (typeof displayName !== 'string') return badRequest(res, 'displayName must be a string');
        input.displayName = displayName;
      }
      if (residenceCountry !== undefined) {
        if (typeof residenceCountry !== 'string') return badRequest(res, 'residenceCountry must be a string');
        input.residenceCountry = residenceCountry;
      }
      if (preferredCurrency !== undefined) {
        if (typeof preferredCurrency !== 'string') return badRequest(res, 'preferredCurrency must be a string');
        input.preferredCurrency = preferredCurrency;
      }
      if (notificationPreferences !== undefined) {
        if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
          return badRequest(res, 'notificationPreferences must be an object');
        }
        input.notificationPreferences = notificationPreferences as Record<string, boolean>;
      }

      const profile = await userService.updateProfile(req.userId!, input);
      return ok(res, profile);
    } catch (err) {
      return next(err);
    }
  });

  // ── Recipients ────────────────────────────────────────────────────────────

  // GET /v1/users/me/recipients
  router.get('/me/recipients', requireAuth, async (req, res, next) => {
    try {
      const recipients = await userService.listRecipients(req.userId!);
      return ok(res, recipients);
    } catch (err) {
      return next(err);
    }
  });

  // POST /v1/users/me/recipients
  router.post('/me/recipients', requireAuth, async (req, res, next) => {
    try {
      const { name, country, payoutMethod, accountDetails } = req.body as Record<string, unknown>;

      if (!name || typeof name !== 'string') return badRequest(res, 'name is required');
      if (!country || typeof country !== 'string') return badRequest(res, 'country is required');
      if (!payoutMethod || typeof payoutMethod !== 'string') return badRequest(res, 'payoutMethod is required');
      if (!VALID_PAYOUT_METHODS.has(payoutMethod)) {
        return badRequest(res, `payoutMethod must be one of: ${[...VALID_PAYOUT_METHODS].join(', ')}`);
      }
      if (!accountDetails || typeof accountDetails !== 'object' || accountDetails === null) {
        return badRequest(res, 'accountDetails is required');
      }

      const recipient = await userService.createRecipient(req.userId!, {
        name,
        country,
        payoutMethod: payoutMethod as 'mobile_money' | 'bank_transfer',
        accountDetails: accountDetails as Parameters<IUserService['createRecipient']>[1]['accountDetails'],
      });
      return ok(res, recipient);
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /v1/users/me/recipients/:id
  router.patch('/me/recipients/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, country, payoutMethod, accountDetails } = req.body as Record<string, unknown>;

      const input: Parameters<IUserService['updateRecipient']>[2] = {};
      if (name !== undefined) {
        if (typeof name !== 'string') return badRequest(res, 'name must be a string');
        input.name = name;
      }
      if (country !== undefined) {
        if (typeof country !== 'string') return badRequest(res, 'country must be a string');
        input.country = country;
      }
      if (payoutMethod !== undefined) {
        if (!VALID_PAYOUT_METHODS.has(payoutMethod as string)) {
          return badRequest(res, `payoutMethod must be one of: ${[...VALID_PAYOUT_METHODS].join(', ')}`);
        }
        input.payoutMethod = payoutMethod as 'mobile_money' | 'bank_transfer';
      }
      if (accountDetails !== undefined) {
        input.accountDetails = accountDetails as Parameters<IUserService['updateRecipient']>[2]['accountDetails'];
      }

      const recipient = await userService.updateRecipient(req.userId!, id, input);
      return ok(res, recipient);
    } catch (err) {
      if (err instanceof Error && err.message === 'Recipient not found') {
        return notFound(res, 'Recipient not found');
      }
      return next(err);
    }
  });

  // DELETE /v1/users/me/recipients/:id
  router.delete('/me/recipients/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      await userService.deleteRecipient(req.userId!, id);
      return ok(res, { deleted: true });
    } catch (err) {
      if (err instanceof Error && err.message === 'Recipient not found') {
        return notFound(res, 'Recipient not found');
      }
      return next(err);
    }
  });

  return router;
}
