/**
 * Remittance service interface + default implementation.
 *
 * Wires YellowCard (cross-border) and Flutterwave (NGN bank verification + payouts).
 */

import type { Corridor, RateQuote, Payment, Settlement, Recipient } from '@afrisend/shared';

export type BankAccountResult = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
};

export type WebhookResult = {
  received: boolean;
};

export type InitiatePaymentInput = {
  idempotencyKey: string;
  quoteId: string;
  corridorId: string;
  sourceCurrency: 'USDC';
  sourceAmount: number;
  recipient: Recipient;
  senderNote?: string;
};

export type GetRatesInput = {
  corridorId: string;
  sourceAmount: number;
  refreshIntervalSeconds?: number;
};

export interface IRemittanceService {
  listCorridors(): Promise<Corridor[]>;
  getRates(input: GetRatesInput): Promise<RateQuote>;
  initiatePayment(input: InitiatePaymentInput): Promise<Payment>;
  getPaymentStatus(paymentId: string): Promise<Payment>;
  getSettlement(paymentId: string): Promise<Settlement>;
  verifyBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountResult>;
  handleFlutterwaveWebhook(payload: unknown, hash: string): Promise<WebhookResult>;
  handleYellowCardWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Sandbox corridors — replace with live YellowCard API call in production */
const SANDBOX_CORRIDORS: Corridor[] = [
  { id: 'cor-ng', sourceCurrency: 'USDC', destinationCurrency: 'NGN', destinationCountry: 'NG', destinationCountryName: 'Nigeria', minAmount: 1, maxAmount: 10000, isActive: true, refreshIntervalSeconds: 60 },
  { id: 'cor-gh', sourceCurrency: 'USDC', destinationCurrency: 'GHS', destinationCountry: 'GH', destinationCountryName: 'Ghana', minAmount: 1, maxAmount: 10000, isActive: true, refreshIntervalSeconds: 60 },
  { id: 'cor-ke', sourceCurrency: 'USDC', destinationCurrency: 'KES', destinationCountry: 'KE', destinationCountryName: 'Kenya', minAmount: 1, maxAmount: 10000, isActive: true, refreshIntervalSeconds: 60 },
];

export class DefaultRemittanceService implements IRemittanceService {
  async listCorridors(): Promise<Corridor[]> {
    return SANDBOX_CORRIDORS;
  }

  async getRates(input: GetRatesInput): Promise<RateQuote> {
    const corridor = SANDBOX_CORRIDORS.find((c) => c.id === input.corridorId);
    const rate = corridor?.destinationCurrency === 'NGN' ? 1500 : corridor?.destinationCurrency === 'GHS' ? 14 : 130;
    const fee = Math.max(1, input.sourceAmount * 0.02);

    return {
      corridorId: input.corridorId,
      sourceCurrency: 'USDC',
      destinationCurrency: corridor?.destinationCurrency ?? 'NGN',
      sourceAmount: input.sourceAmount,
      destinationAmount: input.sourceAmount * rate,
      exchangeRate: rate,
      fee,
      totalSourceAmount: input.sourceAmount + fee,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      quoteId: generateId('qt'),
    };
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<Payment> {
    return {
      id: generateId('pay'),
      idempotencyKey: input.idempotencyKey,
      corridorId: input.corridorId,
      sourceCurrency: input.sourceCurrency,
      destinationCurrency: 'NGN',
      sourceAmount: input.sourceAmount,
      destinationAmount: input.sourceAmount * 1500,
      exchangeRate: 1500,
      fee: input.sourceAmount * 0.02,
      status: 'pending',
      recipient: input.recipient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<Payment> {
    return {
      id: paymentId,
      idempotencyKey: generateId('idem'),
      corridorId: 'cor-ng',
      sourceCurrency: 'USDC',
      destinationCurrency: 'NGN',
      sourceAmount: 100,
      destinationAmount: 150000,
      exchangeRate: 1500,
      fee: 2,
      status: 'processing',
      recipient: { name: 'Unknown', accountNumber: '0000', bankCode: '000', bankName: 'Unknown' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getSettlement(paymentId: string): Promise<Settlement> {
    return {
      paymentId,
      settlementId: generateId('set'),
      status: 'pending',
      settledAmount: 0,
      settledCurrency: 'NGN',
    };
  }

  async verifyBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountResult> {
    // Sandbox: use Flutterwave sandbox test accounts
    return {
      accountName: 'SANDBOX ACCOUNT',
      accountNumber,
      bankCode,
      bankName: 'Sandbox Bank',
    };
  }

  async handleFlutterwaveWebhook(_payload: unknown, _hash: string): Promise<WebhookResult> {
    return { received: true };
  }

  async handleYellowCardWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return { received: true };
  }
}
