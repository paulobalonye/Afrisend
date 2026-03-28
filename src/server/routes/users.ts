import { Router } from 'express';
import type { IAuthService } from '../services/authService';
import { ok, badRequest } from '../middleware/errorHandler';

export function createUsersRouter(authService: IAuthService): Router {
  const router = Router();

  // POST /users/me/profile
  router.post('/me/profile', async (req, res, next) => {
    try {
      const { dateOfBirth, nationality, residenceCountry, purpose } = req.body as Record<string, unknown>;
      if (!dateOfBirth || typeof dateOfBirth !== 'string') return badRequest(res, 'dateOfBirth is required');
      if (!nationality || typeof nationality !== 'string') return badRequest(res, 'nationality is required');
      if (!residenceCountry || typeof residenceCountry !== 'string') return badRequest(res, 'residenceCountry is required');
      if (!purpose || typeof purpose !== 'string') return badRequest(res, 'purpose is required');

      const validPurposes = ['family', 'business', 'savings', 'education', 'other'];
      if (!validPurposes.includes(purpose)) return badRequest(res, `purpose must be one of: ${validPurposes.join(', ')}`);

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

  return router;
}
