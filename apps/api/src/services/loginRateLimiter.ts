/**
 * Login rate limiter.
 *
 * Tracks failed login attempts per (account + IP) pair.
 * After 5 failures, locks out for 15 minutes.
 * Locking is checked per-account AND per-IP independently.
 *
 * The in-memory implementation is for testing.
 * In production, use a Redis-backed store with TTL keys.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export type LockResult =
  | { locked: false }
  | { locked: true; lockedUntil: string };

export interface ILoginRateLimiter {
  isLocked(userId: string, ip: string): Promise<LockResult>;
  recordFailure(userId: string, ip: string): Promise<void>;
  recordSuccess(userId: string, ip: string): Promise<void>;
}

type AttemptRecord = {
  count: number;
  lockedUntil: Date | null;
};

export class LoginRateLimiter implements ILoginRateLimiter {
  /** Keyed by `account:<userId>` or `ip:<ip>` */
  private readonly store = new Map<string, AttemptRecord>();

  async isLocked(userId: string, ip: string): Promise<LockResult> {
    const accountLock = this.checkKey(`account:${userId}`);
    if (accountLock.locked) return accountLock;

    const ipLock = this.checkKey(`ip:${ip}`);
    if (ipLock.locked) return ipLock;

    return { locked: false };
  }

  async recordFailure(userId: string, ip: string): Promise<void> {
    this.increment(`account:${userId}`);
    this.increment(`ip:${ip}`);
  }

  async recordSuccess(userId: string, ip: string): Promise<void> {
    this.store.delete(`account:${userId}`);
    this.store.delete(`ip:${ip}`);
  }

  private checkKey(key: string): LockResult {
    const record = this.store.get(key);
    if (!record) return { locked: false };

    if (record.lockedUntil) {
      if (record.lockedUntil > new Date()) {
        return { locked: true, lockedUntil: record.lockedUntil.toISOString() };
      }
      // Lock expired — reset
      this.store.delete(key);
      return { locked: false };
    }

    return { locked: false };
  }

  private increment(key: string): void {
    const existing = this.store.get(key) ?? { count: 0, lockedUntil: null };
    const next = { count: existing.count + 1, lockedUntil: existing.lockedUntil };

    if (next.count >= MAX_ATTEMPTS && !next.lockedUntil) {
      next.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }

    this.store.set(key, next);
  }
}
