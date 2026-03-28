// ─── Auth Types ───────────────────────────────────────────────────────────────

export type User = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
};

// ─── Recipient Types ──────────────────────────────────────────────────────────

export type PayoutMethod = 'mobile_money' | 'bank_transfer';

export type MobileMoneyDetails = {
  phone: string;
  network: string;
};

export type BankTransferDetails = {
  accountNumber: string;
  bankCode: string;
  bankName: string;
};

export type AccountDetails = MobileMoneyDetails | BankTransferDetails;

export type Recipient = {
  id: string;
  userId: string;
  nickname: string;
  firstName: string;
  lastName: string;
  country: string;
  payoutMethod: PayoutMethod;
  accountDetails: AccountDetails;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecipientRequest = {
  nickname: string;
  firstName: string;
  lastName: string;
  country: string;
  payoutMethod: PayoutMethod;
  accountDetails: AccountDetails;
};

export type UpdateRecipientRequest = Partial<
  Omit<CreateRecipientRequest, 'country' | 'payoutMethod'>
>;

// ─── FX / Corridor Types ─────────────────────────────────────────────────────

export type Corridor = {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string;
  destinationCountryName: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
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

// ─── Transaction Types ────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type Transaction = {
  id: string;
  corridorId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  fee: number;
  status: PaymentStatus;
  recipientName: string;
  recipientCountry: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
};

// ─── Payment Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'card' | 'bank_transfer' | 'open_banking';

export type InitiatePaymentRequest = {
  quoteId: string;
  recipientId: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
};

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
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
};
