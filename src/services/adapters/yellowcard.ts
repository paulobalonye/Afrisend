/**
 * YellowCard adapter interface — cross-border crypto-to-fiat payments to Africa.
 *
 * All secrets sourced from env vars:
 *   YELLOWCARD_API_KEY
 *   YELLOWCARD_SECRET_KEY
 *   YELLOWCARD_WEBHOOK_SECRET
 *
 * Implementations must use idempotency keys on payment initiation.
 * Circuit breaker required for cascading failure protection.
 */

export type YellowCardCorridor = {
  country: string;
  countryCode: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  channels: string[];
};

export type YellowCardRate = {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  fee: number;
  validUntil: string;
};

export type YellowCardPaymentRequest = {
  idempotencyKey: string;
  sourceCurrency: string;
  sourceAmount: number;
  targetCurrency: string;
  targetCountry: string;
  recipient: {
    name: string;
    accountNumber: string;
    bankCode?: string;
    phoneNumber?: string;
  };
  reference: string;
};

export type YellowCardPaymentResponse = {
  paymentId: string;
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  sourceCurrency: string;
  sourceAmount: number;
  targetCurrency: string;
  targetAmount: number;
  rate: number;
  fee: number;
  createdAt: string;
};

export type YellowCardPaymentStatus = {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  settlementStatus?: 'pending' | 'settled' | 'reversed';
  updatedAt: string;
  failureReason?: string;
};

export interface IYellowCardAdapter {
  /**
   * List all supported payment corridors (country + currency combinations).
   */
  listCorridors(): Promise<YellowCardCorridor[]>;

  /**
   * Get current exchange rate for a source → target currency pair.
   */
  getRates(sourceCurrency: string, targetCurrency: string): Promise<YellowCardRate>;

  /**
   * Initiate a cross-border payment. idempotencyKey must be unique per payment.
   */
  initiatePayment(request: YellowCardPaymentRequest): Promise<YellowCardPaymentResponse>;

  /**
   * Get the current status and settlement state of a payment.
   */
  getPaymentStatus(paymentId: string): Promise<YellowCardPaymentStatus>;

  /**
   * Verify a YellowCard webhook signature.
   * Returns true if the payload signature matches YELLOWCARD_WEBHOOK_SECRET.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
