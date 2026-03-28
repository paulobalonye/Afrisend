import { get } from '../client';
import type { PaymentStatus } from './yellowcard';

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

export type GetTransactionsOptions = {
  status?: PaymentStatus;
  limit?: number;
  offset?: number;
};

export async function getTransactions(
  options?: GetTransactionsOptions,
): Promise<Transaction[]> {
  const params: Record<string, unknown> = {};
  if (options?.status) params.status = options.status;
  if (options?.limit !== undefined) params.limit = options.limit;
  if (options?.offset !== undefined) params.offset = options.offset;
  return get<Transaction[]>('/transactions', { params });
}

export async function getTransaction(id: string): Promise<Transaction> {
  return get<Transaction>(`/transactions/${encodeURIComponent(id)}`);
}
