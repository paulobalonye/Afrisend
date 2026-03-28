import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { withRetry } from './retry';
import { createAuditLogger } from './audit';
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

function buildRequestConfig(secretKey: string, idempotencyKey?: string) {
  return {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
  };
}

function assertSuccess<T>(response: FlwApiResponse<T>): T {
  if (response.status !== 'success' || response.data === null) {
    throw new FlutterwaveError(response.message);
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
  const { secretKey, baseUrl = FLUTTERWAVE_BASE_URL, maxRetries = 3 } = config;

  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is required');
  }

  const client = createHttpClient(secretKey, baseUrl);

  async function verifyAccount(request: VerifyAccountRequest): Promise<VerifyAccountResult> {
    const requestId = `verify-${Date.now()}`;
    const timestamp = new Date().toISOString();

    try {
      const result = await withRetry(
        async () => {
          const response = await client.post<FlwApiResponse<ResolveAccountData>>(
            '/accounts/resolve',
            { account_number: request.accountNumber, account_bank: request.bankCode },
            buildRequestConfig(secretKey),
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
    const requestId = `transfer-${Date.now()}`;
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
            buildRequestConfig(secretKey, request.reference),
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
    const requestId = `status-${Date.now()}`;
    const timestamp = new Date().toISOString();

    try {
      const result = await withRetry(
        async () => {
          const response = await client.get<FlwApiResponse<TransferData>>(
            `/transfers/${transferId}`,
            buildRequestConfig(secretKey),
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
