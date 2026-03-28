import { OtpRateLimiter, InMemoryOtpRateLimitStore, OtpRateLimitExceededError } from '../../src/server/otpRateLimiter';

describe('InMemoryOtpRateLimitStore', () => {
  let store: InMemoryOtpRateLimitStore;

  beforeEach(() => {
    store = new InMemoryOtpRateLimitStore();
  });

  it('returns null for unknown keys', async () => {
    const result = await store.get('unknown');
    expect(result).toBeNull();
  });

  it('stores and retrieves a record', async () => {
    const record = { count: 1, windowStart: Date.now() };
    await store.set('key', record, 60_000);
    const retrieved = await store.get('key');
    expect(retrieved).toEqual(record);
  });

  it('expires records after ttlMs', async () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);

    const record = { count: 1, windowStart: now };
    await store.set('key', record, 1_000);

    jest.advanceTimersByTime(1_001);
    const retrieved = await store.get('key');
    expect(retrieved).toBeNull();

    jest.useRealTimers();
  });

  it('overwrites an existing record on set', async () => {
    const first = { count: 1, windowStart: 1000 };
    const second = { count: 2, windowStart: 1000 };
    await store.set('key', first, 60_000);
    await store.set('key', second, 60_000);
    const retrieved = await store.get('key');
    expect(retrieved).toEqual(second);
  });
});

describe('OtpRateLimiter', () => {
  let store: InMemoryOtpRateLimitStore;
  let limiter: OtpRateLimiter;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    jest.useFakeTimers();
    jest.setSystemTime(now);
    store = new InMemoryOtpRateLimitStore();
    limiter = new OtpRateLimiter(store, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('check()', () => {
    it('allows the first request', async () => {
      await expect(limiter.check('+2348012345678')).resolves.not.toThrow();
    });

    it('allows requests up to the max limit', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await expect(limiter.check('+2348012345678')).resolves.not.toThrow();
    });

    it('throws OtpRateLimitExceededError when limit is exceeded', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      await expect(limiter.check('+2348012345678')).rejects.toThrow(OtpRateLimitExceededError);
    });

    it('includes the identifier in the error', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      await expect(limiter.check('+2348012345678')).rejects.toMatchObject({
        identifier: '+2348012345678',
      });
    });

    it('includes retryAfterMs > 0 in the error', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      await expect(limiter.check('+2348012345678')).rejects.toMatchObject({
        retryAfterMs: expect.any(Number),
      });

      try {
        await limiter.check('+2348012345678');
      } catch (err) {
        expect((err as OtpRateLimitExceededError).retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('tracks different identifiers independently', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      // different phone number is unaffected
      await expect(limiter.check('+2349098765432')).resolves.not.toThrow();
    });

    it('resets the window after windowMs elapses', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      await expect(limiter.check('+2348012345678')).resolves.not.toThrow();
    });

    it('does not reset the window before windowMs elapses', async () => {
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');
      await limiter.check('+2348012345678');

      jest.advanceTimersByTime(10 * 60 * 1000 - 1);

      await expect(limiter.check('+2348012345678')).rejects.toThrow(OtpRateLimitExceededError);
    });

    it('works with email identifiers', async () => {
      await limiter.check('user@example.com');
      await limiter.check('user@example.com');
      await limiter.check('user@example.com');

      await expect(limiter.check('user@example.com')).rejects.toThrow(OtpRateLimitExceededError);
    });

    it('uses default limits when constructed without options', async () => {
      const defaultLimiter = new OtpRateLimiter(store);
      await expect(defaultLimiter.check('+2348012345678')).resolves.not.toThrow();
    });

    it('rejects empty identifier', async () => {
      await expect(limiter.check('')).rejects.toThrow('Identifier is required');
    });
  });
});
