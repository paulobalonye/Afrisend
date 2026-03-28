/**
 * Flutterwave adapter interface — bank verification and NGN payouts.
 *
 * All secrets sourced from env vars:
 *   FLUTTERWAVE_SECRET_KEY
 *   FLUTTERWAVE_WEBHOOK_HASH
 *
 * Implementations must be idempotent on all transfer operations (idempotency key required).
 * All calls must be audit-logged. Transient failures must retry with exponential backoff.
 */

export type FlutterwaveAccountInfo = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
};

export type FlutterwaveTransferRequest = {
  idempotencyKey: string;
  amount: number;
  currency: 'NGN';
  accountNumber: string;
  bankCode: string;
  narration: string;
  reference: string;
};

export type FlutterwaveTransferResponse = {
  transferId: string;
  reference: string;
  status: 'NEW' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: number;
  currency: string;
  createdAt: string;
};

export type FlutterwaveTransferStatus = {
  transferId: string;
  status: 'NEW' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  completedAt?: string;
  failureReason?: string;
};

export type FlutterwaveWebhookPayload = {
  event: string;
  data: Record<string, unknown>;
};

export interface IFlutterwaveAdapter {
  /**
   * Resolve a Nigerian bank account name from account number + bank code.
   * Used to display account owner name before confirming a transfer.
   */
  verifyAccount(accountNumber: string, bankCode: string): Promise<FlutterwaveAccountInfo>;

  /**
   * Initiate a NGN bank transfer. Must supply a unique idempotencyKey per transfer.
   * Re-submitting the same key returns the original response without a new transfer.
   */
  initiateTransfer(request: FlutterwaveTransferRequest): Promise<FlutterwaveTransferResponse>;

  /**
   * Poll transfer status by transfer ID.
   */
  getTransferStatus(transferId: string): Promise<FlutterwaveTransferStatus>;

  /**
   * Validate an inbound Flutterwave webhook payload.
   * Compares the `verif-hash` header against FLUTTERWAVE_WEBHOOK_HASH.
   * Returns true if signature is valid, false otherwise.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
