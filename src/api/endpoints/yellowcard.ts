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
  idempotencyKey: string;
  quoteId: string;
  corridorId: string;
  /** Must always be USDC — our FX engine converts sender currency before handing off */
  sourceCurrency: 'USDC';
  sourceAmount: number;
  recipient: Recipient;
  senderNote?: string;
};

// ─── Circuit Breaker (shared across all YellowCard calls) ────────────────────

const yellowcardCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `yc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function callWithAudit<T>(
  operation: string,
  fn: () => Promise<T>,
  auditMetadata?: Record<string, unknown>,
): Promise<T> {
  const requestId = generateRequestId();
  const start = Date.now();
  try {
    const result = await yellowcardCircuitBreaker.execute(() =>
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
    const errorCode = err instanceof Error ? err.message : 'UNKNOWN';
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
  return callWithAudit('listCorridors', () => get<Corridor[]>('/remittance/corridors'));
}

/**
 * Returns only corridors supported by YellowCard.
 * Use this for routing decisions — fall back to Flutterwave for unlisted currencies
 * (EGP, MAD, ETB, etc.).
 */
export async function listSupportedCorridors(): Promise<Corridor[]> {
  const all = await callWithAudit('listSupportedCorridors', () =>
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
  return callWithAudit('getPaymentStatus', () =>
    get<Payment>(`/remittance/payments/${paymentId}`),
  );
}

export async function getSettlement(paymentId: string): Promise<Settlement> {
  return callWithAudit('getSettlement', () =>
    get<Settlement>(`/remittance/payments/${paymentId}/settlement`),
  );
}
