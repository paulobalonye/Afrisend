/**
 * Circuit Breaker — protects downstream provider calls from cascading failures.
 *
 * States:
 *  CLOSED   — calls go through normally
 *  OPEN     — all calls rejected immediately without hitting the provider
 *  HALF_OPEN — one probe call allowed; success → CLOSED, failure → OPEN
 */

export enum CircuitState {
  Closed   = 'closed',
  Open     = 'open',
  HalfOpen = 'half_open',
}

export type CircuitBreakerOptions = {
  /** Number of consecutive failures before the breaker opens. Default: 5 */
  failureThreshold?: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN. Default: 30_000 */
  recoveryTimeMs?: number;
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly recoveryTimeMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeMs = options.recoveryTimeMs ?? 30_000;
  }

  getState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === CircuitState.Open) {
      throw new Error('Circuit open — provider temporarily unavailable');
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
    this.state = CircuitState.Closed;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.failureCount += 1;
    if (this.state === CircuitState.HalfOpen || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.Open;
      this.openedAt = Date.now();
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === CircuitState.Open &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.recoveryTimeMs
    ) {
      this.state = CircuitState.HalfOpen;
    }
  }
}
