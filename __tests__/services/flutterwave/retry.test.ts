import { withRetry, RetryConfig } from '@/services/flutterwave/retry';

describe('withRetry', () => {
  it('returns result immediately when operation succeeds on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await withRetry(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries after transient failure and succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(operation, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      withRetry(operation, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('persistent failure');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('respects maxAttempts configuration', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('fail'));
    const config: RetryConfig = { maxAttempts: 5, baseDelayMs: 1 };

    await expect(withRetry(operation, config)).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('does not retry when shouldRetry returns false', async () => {
    const error = new Error('non-retryable');
    const operation = jest.fn().mockRejectedValue(error);
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(
      withRetry(operation, { maxAttempts: 3, baseDelayMs: 1, shouldRetry }),
    ).rejects.toThrow('non-retryable');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error, 1);
  });

  it('uses exponential backoff — each delay is at least double the previous', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (delay !== undefined && delay > 0) delays.push(delay);
        // Call with 0ms so tests run fast
        return originalSetTimeout(fn as () => void, 0, ...args);
      });

    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');

    await withRetry(operation, { maxAttempts: 3, baseDelayMs: 100 });

    jest.restoreAllMocks();

    expect(delays.length).toBeGreaterThanOrEqual(2);
    // Second delay should be double first (exponential backoff: 100, 200, ...)
    expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
    expect(delays[1]).toBe(delays[0] * 2);
  });

  it('succeeds on last possible attempt', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('last chance');

    const result = await withRetry(operation, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('last chance');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
