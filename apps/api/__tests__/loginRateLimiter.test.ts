/**
 * Tests for login rate limiter.
 * TDD RED phase: 5 failed logins → 15-min lockout per IP and per account.
 */
import { LoginRateLimiter } from '../src/services/loginRateLimiter';

describe('LoginRateLimiter', () => {
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    limiter = new LoginRateLimiter();
  });

  describe('isLocked', () => {
    it('should not be locked initially', async () => {
      const result = await limiter.isLocked('user-123', '1.2.3.4');
      expect(result.locked).toBe(false);
    });

    it('should not lock after fewer than 5 failures', async () => {
      for (let i = 0; i < 4; i++) {
        await limiter.recordFailure('user-123', '1.2.3.4');
      }
      const result = await limiter.isLocked('user-123', '1.2.3.4');
      expect(result.locked).toBe(false);
    });

    it('should lock after 5 failed attempts on the same account', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.recordFailure('user-123', '1.2.3.4');
      }
      const result = await limiter.isLocked('user-123', '1.2.3.4');
      expect(result.locked).toBe(true);
    });

    it('should lock after 5 failed attempts from the same IP (different accounts)', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.recordFailure(`user-${i}`, '5.5.5.5');
      }
      const result = await limiter.isLocked('user-new', '5.5.5.5');
      expect(result.locked).toBe(true);
    });

    it('should include lockout expiry time when locked', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.recordFailure('user-123', '1.2.3.4');
      }
      const result = await limiter.isLocked('user-123', '1.2.3.4');
      expect(result.locked).toBe(true);
      if (!result.locked) throw new Error('Expected locked');
      expect(result.lockedUntil).toBeDefined();
      const lockedUntil = new Date(result.lockedUntil).getTime();
      const nowPlus14min = Date.now() + 14 * 60 * 1000;
      const nowPlus16min = Date.now() + 16 * 60 * 1000;
      expect(lockedUntil).toBeGreaterThan(nowPlus14min);
      expect(lockedUntil).toBeLessThan(nowPlus16min);
    });

    it('should not lock accounts on different IPs that have not exceeded limit', async () => {
      // 4 failures from different IPs for same account = not locked
      for (let i = 0; i < 4; i++) {
        await limiter.recordFailure('user-123', `1.2.3.${i + 1}`);
      }
      const result = await limiter.isLocked('user-123', '9.9.9.9');
      expect(result.locked).toBe(false);
    });
  });

  describe('recordSuccess', () => {
    it('should clear failure count on successful login', async () => {
      for (let i = 0; i < 4; i++) {
        await limiter.recordFailure('user-123', '1.2.3.4');
      }
      await limiter.recordSuccess('user-123', '1.2.3.4');
      const result = await limiter.isLocked('user-123', '1.2.3.4');
      expect(result.locked).toBe(false);
    });
  });
});
