/**
 * SERVER-SIDE USE ONLY
 *
 * Server-side OTP rate limiter for /auth/otp/send and /auth/email/otp/send.
 *
 * Enforces: 3 requests per 10 minutes per identifier (phone or email).
 * Uses a pluggable persistent store (Redis, DB, or in-memory for tests).
 *
 * Unlike the client-side EmailRateLimiter, this runs in the backend API
 * and cannot be bypassed by a modified app or direct API call.
 */

const DEFAULT_MAX_REQUESTS = 3;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export type RateLimitRecord = {
  count: number;
  windowStart: number;
};

export type OtpRateLimiterOptions = {
  maxRequests?: number;
  windowMs?: number;
};

/**
 * Persistent storage interface. Implement with Redis, a database, or
 * InMemoryOtpRateLimitStore for testing.
 */
export interface IOtpRateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void>;
}

export class OtpRateLimitExceededError extends Error {
  constructor(
    public readonly identifier: string,
    public readonly retryAfterMs: number,
  ) {
    super(`OTP rate limit exceeded for ${identifier}. Retry after ${retryAfterMs}ms.`);
    this.name = 'OtpRateLimitExceededError';
  }
}

/**
 * In-memory store for testing. NOT suitable for production multi-instance deployments.
 * Production must use a shared persistent store (Redis or DB).
 */
export class InMemoryOtpRateLimitStore implements IOtpRateLimitStore {
  private readonly entries = new Map<string, { record: RateLimitRecord; expiresAt: number }>();

  async get(key: string): Promise<RateLimitRecord | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.record;
  }

  async set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void> {
    this.entries.set(key, { record, expiresAt: Date.now() + ttlMs });
  }
}

export class OtpRateLimiter {
  private readonly store: IOtpRateLimitStore;
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(store: IOtpRateLimitStore, options: OtpRateLimiterOptions = {}) {
    this.store = store;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  }

  /**
   * Check if the identifier (phone or email) is within the rate limit.
   * Throws OtpRateLimitExceededError if the limit has been reached.
   */
  async check(identifier: string): Promise<void> {
    if (!identifier) {
      throw new Error('Identifier is required');
    }

    const now = Date.now();
    const record = await this.store.get(identifier);

    if (!record || now - record.windowStart >= this.windowMs) {
      await this.store.set(identifier, { count: 1, windowStart: now }, this.windowMs);
      return;
    }

    if (record.count >= this.maxRequests) {
      const retryAfterMs = this.windowMs - (now - record.windowStart);
      throw new OtpRateLimitExceededError(identifier, retryAfterMs);
    }

    const remainingTtlMs = this.windowMs - (now - record.windowStart);
    await this.store.set(
      identifier,
      { count: record.count + 1, windowStart: record.windowStart },
      remainingTtlMs,
    );
  }
}
