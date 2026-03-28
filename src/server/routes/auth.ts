import { Router } from 'express';
import type { IOtpService } from '../services/otpService';
import type { IAuthService } from '../services/authService';
import { ok, badRequest } from '../middleware/errorHandler';

export function createAuthRouter(otpService: IOtpService, authService: IAuthService): Router {
  const router = Router();

  // POST /auth/otp/send
  router.post('/otp/send', async (req, res, next) => {
    try {
      const { phone, countryCode } = req.body as Record<string, unknown>;
      if (!phone || typeof phone !== 'string') return badRequest(res, 'phone is required');
      if (!countryCode || typeof countryCode !== 'string') return badRequest(res, 'countryCode is required');

      const result = await otpService.sendSmsOtp(phone, countryCode);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/otp/verify
  router.post('/otp/verify', async (req, res, next) => {
    try {
      const { sessionId, code, phone } = req.body as Record<string, unknown>;
      if (!sessionId || typeof sessionId !== 'string') return badRequest(res, 'sessionId is required');
      if (!code || typeof code !== 'string') return badRequest(res, 'code is required');
      if (!phone || typeof phone !== 'string') return badRequest(res, 'phone is required');

      const result = await otpService.verifySmsOtp(sessionId, code, phone);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/otp/delivery-status
  router.post('/otp/delivery-status', async (req, res, next) => {
    try {
      const { sessionId } = req.body as Record<string, unknown>;
      if (!sessionId || typeof sessionId !== 'string') return badRequest(res, 'sessionId is required');

      const result = await otpService.getSmsDeliveryStatus(sessionId);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/email/otp/send
  router.post('/email/otp/send', async (req, res, next) => {
    try {
      const { email, locale } = req.body as Record<string, unknown>;
      if (!email || typeof email !== 'string') return badRequest(res, 'email is required');

      const result = await otpService.sendEmailOtp(email, typeof locale === 'string' ? locale : undefined);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/email/otp/verify
  router.post('/email/otp/verify', async (req, res, next) => {
    try {
      const { sessionId, code, email } = req.body as Record<string, unknown>;
      if (!sessionId || typeof sessionId !== 'string') return badRequest(res, 'sessionId is required');
      if (!code || typeof code !== 'string') return badRequest(res, 'code is required');
      if (!email || typeof email !== 'string') return badRequest(res, 'email is required');

      const result = await otpService.verifyEmailOtp(sessionId, code, email);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/register
  router.post('/register', async (req, res, next) => {
    try {
      const { temporaryToken, firstName, lastName, email, password } = req.body as Record<string, unknown>;
      if (!temporaryToken || typeof temporaryToken !== 'string') return badRequest(res, 'temporaryToken is required');
      if (!firstName || typeof firstName !== 'string') return badRequest(res, 'firstName is required');
      if (!lastName || typeof lastName !== 'string') return badRequest(res, 'lastName is required');
      if (!email || typeof email !== 'string') return badRequest(res, 'email is required');
      if (!password || typeof password !== 'string') return badRequest(res, 'password is required');

      const result = await authService.register({ temporaryToken, firstName, lastName, email, password });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/refresh
  router.post('/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = req.body as Record<string, unknown>;
      if (!refreshToken || typeof refreshToken !== 'string') return badRequest(res, 'refreshToken is required');

      const result = await authService.refreshToken(refreshToken);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/logout
  router.post('/logout', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      await authService.logout(token);
      return ok(res, { loggedOut: true });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
