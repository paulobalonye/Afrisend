/**
 * Admin API client.
 *
 * All endpoints require a valid admin JWT (Authorization: Bearer <admin-token>).
 * The apiClient interceptor attaches the token automatically from cookies.
 */
import { get, post, patch } from './client';
import type { Transaction, PaymentStatus } from '@/types';

// ── Admin-specific types ──────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'suspended' | 'closed';

export type FlagType = 'aml_alert' | 'sanctions_hit' | 'manual_review' | 'high_risk';

export type AdminTransaction = Transaction & {
  userId: string;
};

export type FlaggedTransaction = AdminTransaction & {
  flagReason: FlagType;
  flaggedAt: string;
};

export type AdminUserView = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  kycTier: number;
  kycStatus: string;
  monthlyLimit: number;
  accountStatus: AccountStatus;
  createdAt: string;
};

export type CorridorMarkupView = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  markupBps: number;
  minFee: number;
  maxFee: number | null;
  feeStructure: 'flat' | 'percentage' | 'tiered';
};

export type CorridorMetrics = {
  corridorId: string;
  fromCurrency: string;
  toCurrency: string;
  totalVolume: number;
  transactionCount: number;
  successRate: number;
  avgProcessingTimeSec: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type ListTransactionsOptions = {
  status?: PaymentStatus;
  userId?: string;
  page?: number;
  limit?: number;
};

export type ListUsersOptions = {
  kycStatus?: string;
  accountStatus?: AccountStatus;
  page?: number;
  limit?: number;
};

export type ListFlaggedOptions = {
  flagType?: FlagType;
  page?: number;
  limit?: number;
};

export type UpdateUserInput = {
  kycTier?: number;
  accountStatus?: AccountStatus;
  transactionLimit?: number;
};

// ── API functions ─────────────────────────────────────────────────────────────

export async function listAdminTransactions(
  options: ListTransactionsOptions = {},
): Promise<PaginatedResult<AdminTransaction>> {
  const params: Record<string, unknown> = {};
  if (options.status) params.status = options.status;
  if (options.userId) params.userId = options.userId;
  if (options.page !== undefined) params.page = options.page;
  if (options.limit !== undefined) params.limit = options.limit;
  return get<PaginatedResult<AdminTransaction>>('/admin/transactions', { params });
}

export async function getAdminTransaction(id: string): Promise<AdminTransaction> {
  return get<AdminTransaction>(`/admin/transactions/${encodeURIComponent(id)}`);
}

export async function overrideTransactionStatus(
  id: string,
  status: string,
  reason: string,
): Promise<AdminTransaction> {
  return post<AdminTransaction>(`/admin/transactions/${encodeURIComponent(id)}/override`, {
    status,
    reason,
  });
}

export async function listAdminUsers(
  options: ListUsersOptions = {},
): Promise<PaginatedResult<AdminUserView>> {
  const params: Record<string, unknown> = {};
  if (options.kycStatus) params.kycStatus = options.kycStatus;
  if (options.accountStatus) params.accountStatus = options.accountStatus;
  if (options.page !== undefined) params.page = options.page;
  if (options.limit !== undefined) params.limit = options.limit;
  return get<PaginatedResult<AdminUserView>>('/admin/users', { params });
}

export async function updateAdminUser(
  id: string,
  update: UpdateUserInput,
): Promise<AdminUserView> {
  return patch<AdminUserView>(`/admin/users/${encodeURIComponent(id)}`, update);
}

export async function listFxCorridors(): Promise<CorridorMarkupView[]> {
  return get<CorridorMarkupView[]>('/admin/fx/corridors');
}

export async function updateCorridorMarkup(
  corridorId: string,
  markupBps: number,
): Promise<CorridorMarkupView> {
  return patch<CorridorMarkupView>(`/admin/fx/corridors/${encodeURIComponent(corridorId)}`, {
    markupBps,
  });
}

export async function listFlaggedTransactions(
  options: ListFlaggedOptions = {},
): Promise<PaginatedResult<FlaggedTransaction>> {
  const params: Record<string, unknown> = {};
  if (options.flagType) params.flagType = options.flagType;
  if (options.page !== undefined) params.page = options.page;
  if (options.limit !== undefined) params.limit = options.limit;
  return get<PaginatedResult<FlaggedTransaction>>('/admin/compliance', { params });
}

export async function getCorridorMetrics(): Promise<CorridorMetrics[]> {
  return get<CorridorMetrics[]>('/admin/metrics/corridors');
}
