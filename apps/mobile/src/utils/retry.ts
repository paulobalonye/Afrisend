export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  isRetryable: () => true,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let attempt = 0;
  let lastError: unknown;

  while (attempt < opts.maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!opts.isRetryable(err) || attempt + 1 >= opts.maxAttempts) {
        throw err;
      }

      const backoff = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      await delay(backoff);
      attempt++;
    }
  }

  throw lastError;
}

export enum CircuitBreakerState {
  Closed = 'CLOSED',
  Open = 'OPEN',
  HalfOpen = 'HALF_OPEN',
}

type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
};

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.Closed;
  private failureCount = 0;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  getState(): CircuitBreakerState {
    if (
      this.state === CircuitBreakerState.Open &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.state = CircuitBreakerState.HalfOpen;
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitBreakerState.Open) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.Closed;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.failureCount++;
    if (
      this.state === CircuitBreakerState.HalfOpen ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitBreakerState.Open;
      this.openedAt = Date.now();
    }
  }
}
