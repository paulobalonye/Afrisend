const DEFAULT_MAX_REQUESTS = 3;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export class RateLimitExceededError extends Error {
  constructor(
    public readonly email: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Rate limit exceeded for ${email}. Retry after ${retryAfterMs}ms.`);
    this.name = 'RateLimitExceededError';
  }
}

type RateLimiterOptions = {
  maxRequests?: number;
  windowMs?: number;
};

type Record = {
  count: number;
  windowStart: number;
};

export class EmailRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly records = new Map<string, Record>();

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  }

  check(email: string): void {
    const now = Date.now();
    const record = this.records.get(email);

    if (!record || now - record.windowStart >= this.windowMs) {
      this.records.set(email, { count: 1, windowStart: now });
      return;
    }

    if (record.count >= this.maxRequests) {
      const retryAfterMs = this.windowMs - (now - record.windowStart);
      throw new RateLimitExceededError(email, retryAfterMs);
    }

    this.records.set(email, { count: record.count + 1, windowStart: record.windowStart });
  }

  reset(email: string): void {
    this.records.delete(email);
  }
}
