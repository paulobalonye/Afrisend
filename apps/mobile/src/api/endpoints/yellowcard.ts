import { get, post } from '../client';
import { auditLog } from '@/utils/auditLog';
import { withRetry, CircuitBreaker } from '@/utils/retry';

// ─── Corridor Constants ───────────────────────────────────────────────────────

/** Destination currencies supported by YellowCard (crypto-to-fiat off-ramp). */
export const SUPPORTED_CORRIDOR_CURRENCIES: readonly string[] = [
  'NGN', // Nigeria
  'GHS', // Ghana
  'KES', // Kenya
  'UGX', // Uganda
  'TZS', // Tanzania
  'RWF', // Rwanda
  'ZAR', // South Africa
  'ZMW', // Zambia
  'XAF', // Central African CFA
  'XOF', // West African CFA
];

/**
 * Corridors with volatile rates that need a shorter refresh interval (1 min).
 * Others default to 5 min.
 */
export const VOLATILE_CORRIDOR_CURRENCIES: readonly string[] = ['NGN', 'GHS', 'KES'];

// ─── Domain Types ────────────────────────────────────────────────────────────

export type Corridor = {
  id: string;
  /** YellowCard always receives USDC from our FX engine */
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  destinationCountryName: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  /** Rate refresh interval in seconds — 60 for volatile corridors, 300 otherwise */
  refreshIntervalSeconds: number;
};

export type RateQuote = {
  corridorId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  fee: number;
  totalSourceAmount: number;
  expiresAt: string;
  quoteId: string;
};

export type Recipient = {
  name: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
};

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type Payment = {
  id: string;
  idempotencyKey: string;
  corridorId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  fee: number;
  status: PaymentStatus;
  recipient: Recipient;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
};

export type Settlement = {
  paymentId: string;
  settlementId: string;
  status: 'pending' | 'settled' | 'failed';
  settledAmount: number;
  settledCurrency: string;
  settledAt?: string;
};

export type GetRatesRequest = {
  corridorId: string;
  sourceAmount: number;
  /** Override the default refresh interval for this request (seconds) */
  refreshIntervalSeconds?: number;
};

export type InitiatePaymentRequest = {
  /**
   * Caller-supplied idempotency key. MUST be a UUID v4 string.
   * Duplicate keys with the same payment parameters are safely deduplicated by the backend.
   */
  idempotencyKey: string;
  quoteId: string;
  corridorId: string;
  /** Must always be USDC — our FX engine converts sender currency before handing off */
  sourceCurrency: 'USDC';
  sourceAmount: number;
  recipient: Recipient;
  senderNote?: string;
};

/** Structured audit metadata for YellowCard operations (avoids loose Record<string, unknown>). */
export type YellowCardAuditMetadata =
  | { corridorId: string; sourceAmount: number }
  | { corridorId: string; sourceCurrency: string; sourceAmount: number; quoteId: string };

// ─── Circuit Breakers (separate instances for read vs write operations) ───────
//
// HIGH-3 fix: read ops (listCorridors, getRates, getPaymentStatus, getSettlement)
// use readCircuitBreaker; write ops (initiatePayment) use writeCircuitBreaker.
// This prevents a surge of write failures from blocking status-check reads.

export const readCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

export const writeCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * HIGH-1 fix: use crypto.randomUUID() instead of Math.random() for
 * cryptographically secure request-tracking IDs.
 */
function generateRequestId(): string {
  return `yc-${crypto.randomUUID()}`;
}

/** Regex for valid paymentId values — alphanumeric, hyphens, and underscores, 8–64 chars. */
const PAYMENT_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * HIGH-2 fix: validate paymentId before URL interpolation to prevent path traversal.
 * Throws a descriptive error for any input that does not match the expected format.
 */
function validatePaymentId(paymentId: string): void {
  if (!PAYMENT_ID_RE.test(paymentId)) {
    throw new Error(
      `Invalid paymentId: must match ^[a-zA-Z0-9_-]{8,64}$, got "${paymentId}"`,
    );
  }
}

/**
 * MEDIUM-2 fix: sanitise error messages before writing them to the audit log.
 * Strips control characters (including newlines) and truncates to 256 chars to
 * prevent log injection and excessive storage.
 */
function sanitiseErrorCode(message: string): string {
  // eslint-disable-next-line no-control-regex
  return message.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').slice(0, 256);
}

async function callWithAudit<T>(
  operation: string,
  circuitBreaker: CircuitBreaker,
  fn: () => Promise<T>,
  auditMetadata?: YellowCardAuditMetadata,
): Promise<T> {
  const requestId = generateRequestId();
  const start = Date.now();
  try {
    const result = await circuitBreaker.execute(() =>
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 300 }),
    );
    auditLog({
      service: 'yellowcard',
      operation,
      requestId,
      status: 'success',
      durationMs: Date.now() - start,
      metadata: auditMetadata,
    });
    return result;
  } catch (err) {
    // MEDIUM-2: sanitise the error message before persisting to audit log
    const rawMessage = err instanceof Error ? err.message : 'UNKNOWN';
    const errorCode = sanitiseErrorCode(rawMessage);
    auditLog({
      service: 'yellowcard',
      operation,
      requestId,
      status: 'failure',
      durationMs: Date.now() - start,
      errorCode,
      metadata: auditMetadata,
    });
    throw err;
  }
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

/** Returns all corridors from the backend (may include non-YellowCard corridors). */
export async function listCorridors(): Promise<Corridor[]> {
  return callWithAudit('listCorridors', readCircuitBreaker, () =>
    get<Corridor[]>('/remittance/corridors'),
  );
}

/**
 * Returns only corridors supported by YellowCard.
 * Use this for routing decisions — fall back to Flutterwave for unlisted currencies
 * (EGP, MAD, ETB, etc.).
 */
export async function listSupportedCorridors(): Promise<Corridor[]> {
  const all = await callWithAudit('listSupportedCorridors', readCircuitBreaker, () =>
    get<Corridor[]>('/remittance/corridors'),
  );
  return all.filter((c) => SUPPORTED_CORRIDOR_CURRENCIES.includes(c.destinationCurrency));
}

/**
 * Fetches a live rate quote via the v2 rates endpoint.
 * Pass `refreshIntervalSeconds` to hint the backend cache TTL (60s for volatile
 * corridors like NGN, 300s for stable ones).
 */
export async function getRates(request: GetRatesRequest): Promise<RateQuote> {
  const params: Record<string, unknown> = {
    corridorId: request.corridorId,
    sourceAmount: request.sourceAmount,
  };
  if (request.refreshIntervalSeconds !== undefined) {
    params.refreshIntervalSeconds = request.refreshIntervalSeconds;
  }

  return callWithAudit(
    'getRates',
    readCircuitBreaker,
    () => get<RateQuote>('/remittance/v2/rates', { params }),
    { corridorId: request.corridorId, sourceAmount: request.sourceAmount },
  );
}

/**
 * Initiates a payment. Source currency must always be USDC — our FX engine
 * converts the sender's GBP/EUR to USDC before calling this method.
 */
export async function initiatePayment(request: InitiatePaymentRequest): Promise<Payment> {
  // Deliberately exclude recipient PII from audit metadata
  return callWithAudit(
    'initiatePayment',
    writeCircuitBreaker,
    () => post<Payment>('/remittance/payments', request),
    {
      corridorId: request.corridorId,
      sourceCurrency: request.sourceCurrency,
      sourceAmount: request.sourceAmount,
      quoteId: request.quoteId,
    },
  );
}

export async function getPaymentStatus(paymentId: string): Promise<Payment> {
  // HIGH-2: validate paymentId before URL interpolation
  validatePaymentId(paymentId);
  return callWithAudit('getPaymentStatus', readCircuitBreaker, () =>
    get<Payment>(`/remittance/payments/${encodeURIComponent(paymentId)}`),
  );
}

export async function getSettlement(paymentId: string): Promise<Settlement> {
  // HIGH-2: validate paymentId before URL interpolation
  validatePaymentId(paymentId);
  return callWithAudit('getSettlement', readCircuitBreaker, () =>
    get<Settlement>(`/remittance/payments/${encodeURIComponent(paymentId)}/settlement`),
  );
}
