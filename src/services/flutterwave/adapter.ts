import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { withRetry } from './retry';
import { createAuditLogger } from './audit';
import {
  validateTransferId,
  validateNuban,
  validateBankCode,
  validateAmount,
  validateNarration,
  validateCallbackUrl,
} from './validation';
import type {
  FlutterwaveAdapter,
  FlutterwaveConfig,
  VerifyAccountRequest,
  VerifyAccountResult,
  InitiateTransferRequest,
  TransferResult,
  TransferStatusResult,
} from './types';
import { FlutterwaveError } from './types';

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const TRANSFER_TIMEOUT_MS = 30_000;
const ACCOUNT_RESOLVE_TIMEOUT_MS = 10_000;

// Only retry on transient/network errors, not on FlutterwaveError (API-level failures)
function isRetryable(error: unknown): boolean {
  return !(error instanceof FlutterwaveError);
}

const auditLogger = createAuditLogger('flutterwave');

type FlwApiResponse<T> = {
  status: 'success' | 'error';
  message: string;
  data: T | null;
};

type ResolveAccountData = {
  account_number: string;
  account_name: string;
};

type TransferData = {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  narration: string;
  created_at: string;
  complete_time?: string;
};

function buildRequestConfig(secretKey: string, idempotencyKey?: string, timeoutMs?: number) {
  return {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
    ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
  };
}

function assertSuccess<T>(response: FlwApiResponse<T>): T {
  if (response.status !== 'success' || response.data === null) {
    // Sanitize: expose only the message string, not raw API internals
    const safeMessage = typeof response.message === 'string' && response.message.length > 0
      ? response.message
      : 'Flutterwave API request failed';
    throw new FlutterwaveError(safeMessage);
  }
  return response.data;
}

function createHttpClient(secretKey: string, baseUrl: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/**
 * Creates a Flutterwave adapter with the given configuration.
 * Reads FLUTTERWAVE_SECRET_KEY from config (populated from env vars by the caller).
 */
export function createFlutterwaveAdapter(config: FlutterwaveConfig): FlutterwaveAdapter {
  const {
    secretKey,
    baseUrl = FLUTTERWAVE_BASE_URL,
    maxRetries = 3,
    callbackAllowedDomains,
  } = config;

  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is required');
  }

  const client = createHttpClient(secretKey, baseUrl);

  async function verifyAccount(request: VerifyAccountRequest): Promise<VerifyAccountResult> {
    // HIGH-2: validate financial fields before any network call
    validateNuban(request.accountNumber);
    validateBankCode(request.bankCode);

    const requestId = `verify-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    try {
      const result = await withRetry(
        async () => {
          const response = await client.post<FlwApiResponse<ResolveAccountData>>(
            '/accounts/resolve',
            { account_number: request.accountNumber, account_bank: request.bankCode },
            buildRequestConfig(secretKey, undefined, ACCOUNT_RESOLVE_TIMEOUT_MS),
          );
          return assertSuccess(response.data);
        },
        { maxAttempts: maxRetries, shouldRetry: isRetryable },
      );

      auditLogger.log({ requestId, operation: 'verifyAccount', outcome: 'success', timestamp });

      return {
        accountNumber: result.account_number,
        accountName: result.account_name,
        bankCode: request.bankCode,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'verifyAccount failed';
      auditLogger.log({ requestId, operation: 'verifyAccount', outcome: 'failure', timestamp, error: message });
      throw error;
    }
  }

  async function initiateTransfer(request: InitiateTransferRequest): Promise<TransferResult> {
    // HIGH-2: validate all financial fields before any network call
    validateAmount(request.amount);
    validateNuban(request.accountNumber);
    validateBankCode(request.bankCode);
    validateNarration(request.narration);

    // HIGH-3: validate callbackUrl if provided
    if (request.callbackUrl !== undefined) {
      validateCallbackUrl(request.callbackUrl, callbackAllowedDomains);
    }

    const requestId = `transfer-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    try {
      const result = await withRetry(
        async () => {
          const response = await client.post<FlwApiResponse<TransferData>>(
            '/transfers',
            {
              account_number: request.accountNumber,
              account_bank: request.bankCode,
              account_name: request.accountName,
              amount: request.amount,
              currency: 'NGN',
              narration: request.narration,
              reference: request.reference,
              ...(request.callbackUrl ? { callback_url: request.callbackUrl } : {}),
            },
            buildRequestConfig(secretKey, request.reference, TRANSFER_TIMEOUT_MS),
          );
          return assertSuccess(response.data);
        },
        { maxAttempts: maxRetries, shouldRetry: isRetryable },
      );

      auditLogger.log({ requestId, operation: 'initiateTransfer', outcome: 'success', timestamp });

      return {
        id: String(result.id),
        reference: result.reference,
        status: result.status as TransferResult['status'],
        amount: result.amount,
        currency: result.currency,
        narration: result.narration,
        createdAt: result.created_at,
        ...(result.complete_time ? { completedAt: result.complete_time } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'initiateTransfer failed';
      auditLogger.log({ requestId, operation: 'initiateTransfer', outcome: 'failure', timestamp, error: message });
      throw error;
    }
  }

  async function getTransferStatus(transferId: string): Promise<TransferStatusResult> {
    // HIGH-1: validate transferId to prevent path traversal
    validateTransferId(transferId);

    const requestId = `status-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    try {
      const result = await withRetry(
        async () => {
          const response = await client.get<FlwApiResponse<TransferData>>(
            `/transfers/${transferId}`,
            buildRequestConfig(secretKey, undefined, ACCOUNT_RESOLVE_TIMEOUT_MS),
          );
          return assertSuccess(response.data);
        },
        { maxAttempts: maxRetries, shouldRetry: isRetryable },
      );

      auditLogger.log({ requestId, operation: 'getTransferStatus', outcome: 'success', timestamp });

      return {
        id: String(result.id),
        reference: result.reference,
        status: result.status as TransferStatusResult['status'],
        amount: result.amount,
        currency: result.currency,
        ...(result.complete_time ? { completedAt: result.complete_time } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'getTransferStatus failed';
      auditLogger.log({ requestId, operation: 'getTransferStatus', outcome: 'failure', timestamp, error: message });
      throw error;
    }
  }

  return { verifyAccount, initiateTransfer, getTransferStatus };
}
