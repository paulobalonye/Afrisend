export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(baseDelayMs: number, attempt: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  // Add up to 25% jitter to avoid thundering herd
  const jitter = capped * 0.25 * Math.random();
  return Math.round(capped + jitter);
}

/**
 * Wraps an async operation with exponential backoff retry logic.
 * Retries up to maxAttempts times with capped, jittered exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = { ...DEFAULT_CONFIG, ...config };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (shouldRetry && !shouldRetry(error, attempt)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const backoffMs = jitteredBackoff(baseDelayMs, attempt, maxDelayMs);
        await delay(backoffMs);
      }
    }
  }

  throw lastError;
}
