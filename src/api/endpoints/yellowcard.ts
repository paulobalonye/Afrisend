import { get, post } from '../client';
import { auditLog } from '@/utils/auditLog';
import { withRetry, CircuitBreaker } from '@/utils/retry';

// ─── Domain Types ────────────────────────────────────────────────────────────

export type Corridor = {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  destinationCountryName: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
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
};

export type InitiatePaymentRequest = {
  idempotencyKey: string;
  quoteId: string;
  corridorId: string;
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

export async function listCorridors(): Promise<Corridor[]> {
  return callWithAudit('listCorridors', () => get<Corridor[]>('/remittance/corridors'));
}

export async function getRates(request: GetRatesRequest): Promise<RateQuote> {
  return callWithAudit(
    'getRates',
    () =>
      get<RateQuote>('/remittance/rates', {
        params: { corridorId: request.corridorId, sourceAmount: request.sourceAmount },
      }),
    { corridorId: request.corridorId, sourceAmount: request.sourceAmount },
  );
}

export async function initiatePayment(request: InitiatePaymentRequest): Promise<Payment> {
  // Deliberately exclude recipient PII from audit metadata
  return callWithAudit(
    'initiatePayment',
    () => post<Payment>('/remittance/payments', request),
    {
      corridorId: request.corridorId,
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
