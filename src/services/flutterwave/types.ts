export type VerifyAccountRequest = {
  accountNumber: string;
  bankCode: string;
};

export type VerifyAccountResult = {
  accountNumber: string;
  accountName: string;
  bankCode: string;
};

export type InitiateTransferRequest = {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amount: number;
  narration: string;
  reference: string;
  callbackUrl?: string;
};

export type TransferStatus = 'NEW' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export type TransferResult = {
  id: string;
  reference: string;
  status: TransferStatus;
  amount: number;
  currency: string;
  narration: string;
  completedAt?: string;
  createdAt: string;
};

export type TransferStatusResult = {
  id: string;
  reference: string;
  status: TransferStatus;
  amount: number;
  currency: string;
  completedAt?: string;
};

export type WebhookEvent = {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    [key: string]: unknown;
  };
};

export type FlutterwaveAdapter = {
  verifyAccount(request: VerifyAccountRequest): Promise<VerifyAccountResult>;
  initiateTransfer(request: InitiateTransferRequest): Promise<TransferResult>;
  getTransferStatus(transferId: string): Promise<TransferStatusResult>;
};

export type FlutterwaveConfig = {
  secretKey: string;
  baseUrl?: string;
  maxRetries?: number;
};

export class FlutterwaveError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'FlutterwaveError';
  }
}
