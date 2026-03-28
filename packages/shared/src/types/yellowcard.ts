// Shared YellowCard types used by both apps/mobile and apps/api

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

/** Structured audit metadata for YellowCard operations. */
export type YellowCardAuditMetadata =
  | { corridorId: string; sourceAmount: number }
  | { corridorId: string; sourceCurrency: string; sourceAmount: number; quoteId: string };
