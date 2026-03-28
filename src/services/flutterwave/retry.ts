export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with exponential backoff retry logic.
 * Retries up to maxAttempts times with doubling delay between each attempt.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, shouldRetry } = { ...DEFAULT_CONFIG, ...config };

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
        const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
        await delay(backoffMs);
      }
    }
  }

  throw lastError;
}
