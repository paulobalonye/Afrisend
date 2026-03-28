import { get } from './client';
import type { Transaction, PaymentStatus } from '@/types';

export type GetTransactionsOptions = {
  status?: PaymentStatus;
  limit?: number;
  offset?: number;
};

export async function getTransactions(options?: GetTransactionsOptions): Promise<Transaction[]> {
  const params: Record<string, unknown> = {};
  if (options?.status) params.status = options.status;
  if (options?.limit !== undefined) params.limit = options.limit;
  if (options?.offset !== undefined) params.offset = options.offset;
  return get<Transaction[]>('/transactions', { params });
}

export async function getTransaction(id: string): Promise<Transaction> {
  return get<Transaction>(`/transactions/${encodeURIComponent(id)}`);
}
