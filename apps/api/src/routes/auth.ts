import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { IOtpService } from '../services/otpService';
import type { IAuthService } from '../services/authService';
import type { MfaService } from '../services/mfaService';
import { ok, badRequest } from '../middleware/errorHandler';

type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function createAuthRouter(
  otpService: IOtpService,
  authService: IAuthService,
  mfaService?: MfaService,
  requireAuth?: AsyncMiddleware
): Router {
  const router = Router();

  // ─── Existing OTP flows (unchanged) ─────────────────────────────────────────

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

  // ─── Auth endpoints ──────────────────────────────────────────────────────────

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

  // POST /auth/login
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password, deviceFingerprint } = req.body as Record<string, unknown>;
      if (!email || typeof email !== 'string') return badRequest(res, 'email is required');
      if (!password || typeof password !== 'string') return badRequest(res, 'password is required');

      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
        ?? req.socket.remoteAddress
        ?? 'unknown';

      const result = await authService.login({
        email,
        password,
        deviceFingerprint: typeof deviceFingerprint === 'string' ? deviceFingerprint : 'unknown',
        ip,
      });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/token/refresh
  router.post('/token/refresh', async (req, res, next) => {
    try {
      const { refreshToken, deviceFingerprint } = req.body as Record<string, unknown>;
      if (!refreshToken || typeof refreshToken !== 'string') return badRequest(res, 'refreshToken is required');

      const result = await authService.refreshToken(
        refreshToken,
        typeof deviceFingerprint === 'string' ? deviceFingerprint : 'unknown'
      );
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // Keep legacy /auth/refresh for backwards compat
  router.post('/refresh', async (req, res, next) => {
    try {
      const { refreshToken, deviceFingerprint } = req.body as Record<string, unknown>;
      if (!refreshToken || typeof refreshToken !== 'string') return badRequest(res, 'refreshToken is required');

      const result = await authService.refreshToken(
        refreshToken,
        typeof deviceFingerprint === 'string' ? deviceFingerprint : 'unknown'
      );
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /auth/logout
  router.post('/logout', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.replace('Bearer ', '');
      const { refreshToken } = req.body as Record<string, unknown>;
      await authService.logout(
        accessToken,
        typeof refreshToken === 'string' ? refreshToken : undefined
      );
      return ok(res, { loggedOut: true });
    } catch (err) {
      return next(err);
    }
  });

  // ─── MFA endpoints (only registered when MFA service is available) ──────────

  if (mfaService && requireAuth) {
    // POST /auth/mfa/login — complete login with TOTP or backup code
    router.post('/mfa/login', async (req, res, next) => {
      try {
        const { challengeToken, code, deviceFingerprint } = req.body as Record<string, unknown>;
        if (!challengeToken || typeof challengeToken !== 'string') return badRequest(res, 'challengeToken is required');
        if (!code || typeof code !== 'string') return badRequest(res, 'code is required');

        const result = await authService.completeMfaLogin(
          challengeToken,
          code,
          typeof deviceFingerprint === 'string' ? deviceFingerprint : 'unknown'
        );
        return ok(res, result);
      } catch (err) {
        return next(err);
      }
    });
    // POST /auth/mfa/setup — begin MFA enrollment (returns QR secret + backup codes)
    router.post('/mfa/setup', requireAuth, async (req, res, next) => {
      try {
        const userId = req.userId;
        if (!userId) return badRequest(res, 'Authentication required');

        const { email } = req.body as Record<string, unknown>;
        if (!email || typeof email !== 'string') return badRequest(res, 'email is required');

        const result = await mfaService.setup(userId, email);
        return ok(res, {
          otpauthUrl: result.otpauthUrl,
          secret: result.secret,
        });
      } catch (err) {
        return next(err);
      }
    });

    // POST /auth/mfa/confirm — confirm setup with a TOTP code to activate MFA
    router.post('/mfa/confirm', requireAuth, async (req, res, next) => {
      try {
        const userId = req.userId;
        if (!userId) return badRequest(res, 'Authentication required');

        const { token } = req.body as Record<string, unknown>;
        if (!token || typeof token !== 'string') return badRequest(res, 'token is required');

        const result = await mfaService.confirmSetup(userId, token);
        if (!result) return badRequest(res, 'Invalid TOTP code. Scan QR and try again.');

        return ok(res, { mfaEnabled: true, backupCodes: result.backupCodes });
      } catch (err) {
        return next(err);
      }
    });

    // POST /auth/mfa/disable — disable MFA (requires valid TOTP code)
    router.post('/mfa/disable', requireAuth, async (req, res, next) => {
      try {
        const userId = req.userId;
        if (!userId) return badRequest(res, 'Authentication required');

        const { token } = req.body as Record<string, unknown>;
        if (!token || typeof token !== 'string') return badRequest(res, 'token is required');

        const disabled = await mfaService.disable(userId, token);
        if (!disabled) return badRequest(res, 'Invalid TOTP code');

        return ok(res, { mfaEnabled: false });
      } catch (err) {
        return next(err);
      }
    });

    // GET /auth/mfa/status — check if MFA is enabled for the user
    router.get('/mfa/status', requireAuth, async (req, res, next) => {
      try {
        const userId = req.userId;
        if (!userId) return badRequest(res, 'Authentication required');

        const status = await mfaService.getStatus(userId);
        return ok(res, status);
      } catch (err) {
        return next(err);
      }
    });
  }

  return router;
}
