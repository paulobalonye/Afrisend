/**
 * Payout Routing Service
 *
 * Routes outgoing transactions to the correct payout provider based on:
 *  - Destination country
 *  - Payout method (mobile_money | bank_transfer)
 *  - Provider availability (circuit breaker)
 *
 * Supported corridors:
 *  NG → Flutterwave (bank_transfer)
 *  KE → M-Pesa (mobile_money), Airtel Money (fallback)
 *  GH → MTN MoMo (mobile_money), Flutterwave (bank_transfer fallback)
 *  UG → MTN MoMo (mobile_money), Airtel Money (fallback)
 *  TZ → M-Pesa (mobile_money), Airtel Money (fallback)
 *
 * Each provider is wrapped in a CircuitBreaker. If the primary provider's
 * circuit is open, the service falls back to the next eligible provider.
 */

import { CircuitBreaker, type CircuitBreakerOptions } from './circuitBreaker';
import type { ITransactionService } from './transactionService';
import { TransactionStatus } from './transactionService';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type PayoutMethod = 'mobile_money' | 'bank_transfer';

export type PayoutRecipient = {
  name: string;
  accountNumber: string | null;
  bankCode: string | null;
  phoneNumber: string | null;
};

export type PayoutRequest = {
  transactionId: string;
  amount: number;
  currency: string;
  destinationCountry: string;
  method: PayoutMethod;
  recipient: PayoutRecipient;
};

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PayoutResult = {
  providerRef: string;
  status: PayoutStatus;
  provider: string;
  raw: unknown;
};

export type PayoutStatusUpdate = {
  transactionId: string;
  providerRef: string;
  provider: string;
  status: PayoutStatus;
  failureReason?: string;
};

// ─── Provider interface ───────────────────────────────────────────────────────

export interface IPayoutProvider {
  readonly name: string;
  readonly supportedCountries: ReadonlyArray<string>;
  readonly supportedMethods: ReadonlyArray<PayoutMethod>;

  initiatePayout(request: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(providerRef: string): Promise<PayoutResult>;
}

// ─── Routing service interface ────────────────────────────────────────────────

export interface IPayoutRoutingService {
  /**
   * Route a payout request to the best available provider.
   * Falls back through eligible providers if the primary fails.
   */
  route(request: PayoutRequest): Promise<PayoutResult>;

  /**
   * Handle an inbound provider status webhook and propagate the status
   * change to the associated transaction via the TransactionService.
   */
  handleStatusUpdate(update: PayoutStatusUpdate): Promise<void>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

type ProviderEntry = {
  provider: IPayoutProvider;
  circuitBreaker: CircuitBreaker;
};

/**
 * Priority order per (country, method).
 * First match wins; remaining entries are fallbacks.
 */
const ROUTING_TABLE: ReadonlyArray<{
  country: string;
  method: PayoutMethod;
  providerNames: ReadonlyArray<string>;
}> = [
  { country: 'NG', method: 'bank_transfer',  providerNames: ['flutterwave'] },
  { country: 'KE', method: 'mobile_money',   providerNames: ['mpesa', 'airtel_money'] },
  { country: 'KE', method: 'bank_transfer',  providerNames: ['flutterwave'] },
  { country: 'GH', method: 'mobile_money',   providerNames: ['mtn_momo', 'flutterwave'] },
  { country: 'GH', method: 'bank_transfer',  providerNames: ['flutterwave'] },
  { country: 'UG', method: 'mobile_money',   providerNames: ['mtn_momo', 'airtel_money'] },
  { country: 'TZ', method: 'mobile_money',   providerNames: ['mpesa', 'airtel_money'] },
  { country: 'RW', method: 'mobile_money',   providerNames: ['mtn_momo'] },
];

export class PayoutRoutingService implements IPayoutRoutingService {
  private readonly entries: ReadonlyArray<ProviderEntry>;
  private readonly txService: ITransactionService | null;

  constructor(
    providers: ReadonlyArray<IPayoutProvider>,
    circuitOptions: CircuitBreakerOptions = {},
    txService: ITransactionService | null = null,
  ) {
    this.entries = providers.map((p) => ({
      provider: p,
      circuitBreaker: new CircuitBreaker(circuitOptions),
    }));
    this.txService = txService;
  }

  async route(request: PayoutRequest): Promise<PayoutResult> {
    const ordered = this.resolveProviders(request.destinationCountry, request.method);

    if (ordered.length === 0) {
      throw new Error(
        `No provider supports country=${request.destinationCountry} method=${request.method}`,
      );
    }

    const errors: string[] = [];

    for (const { provider, circuitBreaker } of ordered) {
      try {
        const result = await circuitBreaker.execute(() => provider.initiatePayout(request));
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
        // continue to next provider
      }
    }

    throw new Error(`All providers failed — ${errors.join('; ')}`);
  }

  async handleStatusUpdate(update: PayoutStatusUpdate): Promise<void> {
    if (!this.txService) return;

    const tx = await this.txService.getById(update.transactionId);

    const targetStatus =
      update.status === 'completed'
        ? TransactionStatus.Completed
        : update.status === 'failed'
          ? TransactionStatus.Failed
          : null;

    if (!targetStatus) return;

    await this.txService.transitionTo(tx.id, targetStatus, {
      note: update.failureReason,
      actor: `payout:${update.provider}`,
      payoutReference: update.providerRef,
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private resolveProviders(country: string, method: PayoutMethod): ProviderEntry[] {
    const route = ROUTING_TABLE.find(
      (r) => r.country === country && r.method === method,
    );
    if (!route) return [];

    const result: ProviderEntry[] = [];
    for (const name of route.providerNames) {
      const entry = this.entries.find((e) => e.provider.name === name);
      if (entry) result.push(entry);
    }
    return result;
  }
}
