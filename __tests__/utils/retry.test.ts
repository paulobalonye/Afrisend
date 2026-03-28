import {
  withRetry,
  CircuitBreaker,
  CircuitBreakerState,
  RetryOptions,
} from '../../src/utils/retry';

// Helper: mock setTimeout to execute callback immediately but capture delay values
function mockSetTimeoutImmediate(): { delays: number[]; restore: () => void } {
  const delays: number[] = [];
  const original = global.setTimeout;
  (global as unknown as { setTimeout: unknown }).setTimeout = (cb: () => void, ms?: number) => {
    if (typeof ms === 'number') delays.push(ms);
    return original(cb, 0); // run immediately
  };
  return {
    delays,
    restore: () => {
      (global as unknown as { setTimeout: unknown }).setTimeout = original;
    },
  };
}

describe('withRetry', () => {
  it('returns result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const { restore } = mockSetTimeoutImmediate();
    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce('ok');

      const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  });

  it('throws after exhausting all retries', async () => {
    const { restore } = mockSetTimeoutImmediate();
    try {
      const error = new Error('permanent');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('permanent');
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      restore();
    }
  });

  it('uses exponential backoff between retries', async () => {
    const { delays, restore } = mockSetTimeoutImmediate();
    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('ok');

      await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 10000 });

      // First retry: 100ms (2^0 * 100), second retry: 200ms (2^1 * 100)
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
    } finally {
      restore();
    }
  });

  it('caps delay at maxDelayMs', async () => {
    const { delays, restore } = mockSetTimeoutImmediate();
    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('ok');

      await withRetry(fn, { maxAttempts: 4, baseDelayMs: 1000, maxDelayMs: 1500 });

      delays.forEach((d) => expect(d).toBeLessThanOrEqual(1500));
    } finally {
      restore();
    }
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fatal'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, isRetryable: () => false }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default options when none provided', async () => {
    const { restore } = mockSetTimeoutImmediate();
    try {
      const fn = jest.fn().mockResolvedValue('default');
      const result = await withRetry(fn);
      expect(result).toBe('default');
    } finally {
      restore();
    }
  });
});

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('stays closed when failures are below threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    await expect(cb.execute(fn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe(CircuitBreakerState.Closed);

    await cb.execute(fn);
    expect(cb.getState()).toBe(CircuitBreakerState.Closed);
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    await expect(cb.execute(fn)).rejects.toThrow();

    expect(cb.getState()).toBe(CircuitBreakerState.Open);
  });

  it('rejects immediately when open without calling fn', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    await expect(cb.execute(fn)).rejects.toThrow();

    const guardFn = jest.fn().mockResolvedValue('should not be called');
    await expect(cb.execute(guardFn)).rejects.toThrow('Circuit breaker is open');
    expect(guardFn).not.toHaveBeenCalled();
  });

  it('transitions to half-open after reset timeout', async () => {
    const fakeNow = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 500 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.Open);

    fakeNow.mockReturnValue(1700);
    expect(cb.getState()).toBe(CircuitBreakerState.HalfOpen);
    fakeNow.mockRestore();
  });

  it('closes again on success in half-open state', async () => {
    const fakeNow = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 500 });
    const failFn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(failFn)).rejects.toThrow();
    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.Open);

    fakeNow.mockReturnValue(1700); // advance 700ms past reset timeout
    expect(cb.getState()).toBe(CircuitBreakerState.HalfOpen);

    const successFn = jest.fn().mockResolvedValue('recovered');
    const result = await cb.execute(successFn);
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe(CircuitBreakerState.Closed);
    fakeNow.mockRestore();
  });

  it('reopens on failure in half-open state', async () => {
    const fakeNow = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 500 });
    const failFn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(failFn)).rejects.toThrow();
    await expect(cb.execute(failFn)).rejects.toThrow();

    fakeNow.mockReturnValue(1700);
    expect(cb.getState()).toBe(CircuitBreakerState.HalfOpen);

    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.Open);
    fakeNow.mockRestore();
  });

  it('resets failure count on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const failFn = jest.fn().mockRejectedValue(new Error('fail'));
    const successFn = jest.fn().mockResolvedValue('ok');

    await expect(cb.execute(failFn)).rejects.toThrow();
    await expect(cb.execute(failFn)).rejects.toThrow();
    await cb.execute(successFn); // success resets count

    // Should need 3 more failures to open
    await expect(cb.execute(failFn)).rejects.toThrow();
    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.Closed);

    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.Open);
  });
});
