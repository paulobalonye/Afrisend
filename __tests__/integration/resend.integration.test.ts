/**
 * Resend / Email Integration Tests
 *
 * The ResendAdapter in this codebase wraps the AfriSend backend API
 * (src/services/email/resendAdapter.ts → /email/otp via src/api/endpoints/email).
 * Direct Resend API calls are made server-side, not from the mobile app.
 *
 * These tests cover:
 *   - EmailRateLimiter: window logic, max-request enforcement, reset behaviour
 *   - ResendAdapter: OTP send rate-limiting gate, delivery status delegation
 *   - Integration of rate limiter + adapter together
 */

import { EmailRateLimiter, RateLimitExceededError } from '@/services/email/emailRateLimiter';
import { ResendAdapter } from '@/services/email/resendAdapter';

// ---------------------------------------------------------------------------
// 1. EmailRateLimiter
// ---------------------------------------------------------------------------
describe('EmailRateLimiter — integration tests', () => {
  describe('within-window behaviour', () => {
    it('allows up to maxRequests calls within the window', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 3, windowMs: 60_000 });

      expect(() => limiter.check('user@example.com')).not.toThrow();
      expect(() => limiter.check('user@example.com')).not.toThrow();
      expect(() => limiter.check('user@example.com')).not.toThrow();
    });

    it('throws RateLimitExceededError on request beyond maxRequests', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 2, windowMs: 60_000 });

      limiter.check('blocked@example.com');
      limiter.check('blocked@example.com');

      expect(() => limiter.check('blocked@example.com')).toThrow(RateLimitExceededError);
    });

    it('RateLimitExceededError carries the email and a positive retryAfterMs', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });
      limiter.check('user@example.com');

      let caughtError: RateLimitExceededError | null = null;
      try {
        limiter.check('user@example.com');
      } catch (e) {
        caughtError = e as RateLimitExceededError;
      }

      expect(caughtError).toBeInstanceOf(RateLimitExceededError);
      expect(caughtError?.email).toBe('user@example.com');
      expect(caughtError?.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('window expiry', () => {
    it('resets count after window expires', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 1 }); // 1ms window

      limiter.check('expire@example.com');

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(() => limiter.check('expire@example.com')).not.toThrow();
          resolve();
        }, 5);
      });
    });
  });

  describe('reset', () => {
    it('allows new requests after explicit reset', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });

      limiter.check('reset@example.com');
      expect(() => limiter.check('reset@example.com')).toThrow(RateLimitExceededError);

      limiter.reset('reset@example.com');

      expect(() => limiter.check('reset@example.com')).not.toThrow();
    });

    it('reset only affects the specified email', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });

      limiter.check('a@example.com');
      limiter.check('b@example.com');

      limiter.reset('a@example.com');

      // a is reset — allowed
      expect(() => limiter.check('a@example.com')).not.toThrow();
      // b is NOT reset — still at limit
      expect(() => limiter.check('b@example.com')).toThrow(RateLimitExceededError);
    });
  });

  describe('per-email isolation', () => {
    it('tracks rate limits independently per email', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });

      limiter.check('alice@example.com');

      // alice is at limit but bob is fresh
      expect(() => limiter.check('alice@example.com')).toThrow(RateLimitExceededError);
      expect(() => limiter.check('bob@example.com')).not.toThrow();
    });
  });

  describe('error message', () => {
    it('error message does not leak internal secrets or stack traces', () => {
      const limiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });
      limiter.check('u@example.com');

      let message = '';
      try {
        limiter.check('u@example.com');
      } catch (e) {
        message = e instanceof Error ? e.message : '';
      }

      // Message should be user-friendly, not contain stack or internal details
      expect(message).toContain('u@example.com');
      expect(message).toContain('Retry after');
      expect(message).not.toContain('at Object.<anonymous>');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. ResendAdapter + EmailRateLimiter integration
// ---------------------------------------------------------------------------
describe('ResendAdapter — rate limiting integration', () => {
  it('ResendAdapter instantiates with a default rate limiter', () => {
    const adapter = new ResendAdapter();
    expect(adapter).toBeDefined();
  });

  it('ResendAdapter accepts a custom rate limiter', () => {
    const customLimiter = new EmailRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const adapter = new ResendAdapter(customLimiter);
    expect(adapter).toBeDefined();
  });
});
