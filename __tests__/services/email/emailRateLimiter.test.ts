import { EmailRateLimiter, RateLimitExceededError } from '../../../src/services/email/emailRateLimiter';

describe('EmailRateLimiter', () => {
  let limiter: EmailRateLimiter;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    jest.useFakeTimers();
    jest.setSystemTime(now);
    limiter = new EmailRateLimiter({ maxRequests: 3, windowMs: 10 * 60 * 1000 }); // 3 per 10 min
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests up to the limit', () => {
    expect(() => limiter.check('alice@example.com')).not.toThrow();
    expect(() => limiter.check('alice@example.com')).not.toThrow();
    expect(() => limiter.check('alice@example.com')).not.toThrow();
  });

  it('throws RateLimitExceededError when limit is exceeded', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    expect(() => limiter.check('alice@example.com')).toThrow(RateLimitExceededError);
  });

  it('includes the email in the error', () => {
    limiter.check('bob@example.com');
    limiter.check('bob@example.com');
    limiter.check('bob@example.com');

    try {
      limiter.check('bob@example.com');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitExceededError);
      expect((err as RateLimitExceededError).email).toBe('bob@example.com');
    }
  });

  it('tracks different emails independently', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    // bob is unaffected
    expect(() => limiter.check('bob@example.com')).not.toThrow();
  });

  it('resets the window after windowMs elapses', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    // advance past the window
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(() => limiter.check('alice@example.com')).not.toThrow();
  });

  it('does not reset early (before window expires)', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    jest.advanceTimersByTime(10 * 60 * 1000 - 1);

    expect(() => limiter.check('alice@example.com')).toThrow(RateLimitExceededError);
  });

  it('provides retryAfterMs in the error', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    try {
      limiter.check('alice@example.com');
    } catch (err) {
      expect((err as RateLimitExceededError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('uses default limits when constructed with no options', () => {
    const defaultLimiter = new EmailRateLimiter();
    // default: 3 per 10 min — should not throw on first request
    expect(() => defaultLimiter.check('test@example.com')).not.toThrow();
  });

  it('reset() clears the record for a specific email', () => {
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');
    limiter.check('alice@example.com');

    limiter.reset('alice@example.com');

    expect(() => limiter.check('alice@example.com')).not.toThrow();
  });
});
