/**
 * Admin Service — cross-cutting admin operations.
 *
 * Provides:
 *  - Transaction listing/overrides across all users
 *  - User management (KYC tier, account status)
 *  - FX corridor markup management
 *  - Compliance queue (flagged transactions)
 *  - Corridor performance metrics
 *
 * The default implementation is an in-memory sandbox.
 * Swap with a DB-backed implementation for production.
 */

import type { Transaction, TransactionStatus } from './transactionService';
import type { UserProfile } from './userService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'suspended' | 'closed';

export type AdminUserView = UserProfile & {
  accountStatus: AccountStatus;
};

export type FlagType = 'aml_alert' | 'sanctions_hit' | 'manual_review' | 'high_risk';

export type FlaggedTransaction = Transaction & {
  flagReason: FlagType;
  flaggedAt: string;
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

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type ListTransactionsFilter = {
  status?: string;
  userId?: string;
  page?: number;
  limit?: number;
};

export type ListUsersFilter = {
  kycStatus?: string;
  accountStatus?: AccountStatus;
  page?: number;
  limit?: number;
};

export type ListFlaggedFilter = {
  flagType?: FlagType;
  page?: number;
  limit?: number;
};

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IAdminService {
  listTransactions(filter: ListTransactionsFilter): Promise<Paginated<Transaction>>;
  getTransaction(transactionId: string): Promise<Transaction>;
  overrideTransactionStatus(
    transactionId: string,
    newStatus: TransactionStatus,
    reason: string,
    adminId: string,
  ): Promise<Transaction>;
  listUsers(filter: ListUsersFilter): Promise<Paginated<AdminUserView>>;
  updateUser(
    userId: string,
    update: { kycTier?: number; accountStatus?: AccountStatus; transactionLimit?: number },
  ): Promise<AdminUserView>;
  listFxCorridors(): Promise<CorridorMarkupView[]>;
  updateCorridorMarkup(corridorId: string, markupBps: number): Promise<CorridorMarkupView>;
  listFlaggedTransactions(filter: ListFlaggedFilter): Promise<Paginated<FlaggedTransaction>>;
  getCorridorMetrics(): Promise<CorridorMetrics[]>;
}

// ── In-memory implementation ──────────────────────────────────────────────────

export class DefaultAdminService implements IAdminService {
  private transactions: Transaction[] = [];
  private users: AdminUserView[] = [];
  private corridors: CorridorMarkupView[] = [
    {
      id: 'corridor-gbp-ngn',
      fromCurrency: 'GBP',
      toCurrency: 'NGN',
      markupBps: 150,
      minFee: 2.99,
      maxFee: null,
      feeStructure: 'percentage',
    },
    {
      id: 'corridor-usd-kes',
      fromCurrency: 'USD',
      toCurrency: 'KES',
      markupBps: 120,
      minFee: 1.99,
      maxFee: null,
      feeStructure: 'percentage',
    },
    {
      id: 'corridor-eur-ghs',
      fromCurrency: 'EUR',
      toCurrency: 'GHS',
      markupBps: 180,
      minFee: 2.49,
      maxFee: null,
      feeStructure: 'percentage',
    },
  ];
  private flaggedTransactions: FlaggedTransaction[] = [];

  // Allow test/seeding injection
  constructor(seed?: {
    transactions?: Transaction[];
    users?: AdminUserView[];
    flagged?: FlaggedTransaction[];
  }) {
    if (seed?.transactions) this.transactions = [...seed.transactions];
    if (seed?.users) this.users = [...seed.users];
    if (seed?.flagged) this.flaggedTransactions = [...seed.flagged];
  }

  async listTransactions(filter: ListTransactionsFilter): Promise<Paginated<Transaction>> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));

    let filtered = this.transactions;
    if (filter.status) {
      filtered = filtered.filter((t) => t.status === filter.status);
    }
    if (filter.userId) {
      filtered = filtered.filter((t) => t.userId === filter.userId);
    }

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error('Transaction not found');
    return tx;
  }

  async overrideTransactionStatus(
    transactionId: string,
    newStatus: TransactionStatus,
    _reason: string,
    _adminId: string,
  ): Promise<Transaction> {
    const idx = this.transactions.findIndex((t) => t.id === transactionId);
    if (idx === -1) throw new Error('Transaction not found');
    const updated = { ...this.transactions[idx], status: newStatus, updatedAt: new Date() };
    this.transactions = [
      ...this.transactions.slice(0, idx),
      updated,
      ...this.transactions.slice(idx + 1),
    ];
    return updated;
  }

  async listUsers(filter: ListUsersFilter): Promise<Paginated<AdminUserView>> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));

    let filtered = this.users;
    if (filter.kycStatus) {
      filtered = filtered.filter((u) => u.kycStatus === filter.kycStatus);
    }
    if (filter.accountStatus) {
      filtered = filtered.filter((u) => u.accountStatus === filter.accountStatus);
    }

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  async updateUser(
    userId: string,
    update: { kycTier?: number; accountStatus?: AccountStatus; transactionLimit?: number },
  ): Promise<AdminUserView> {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const current = this.users[idx];
    const updated: AdminUserView = {
      ...current,
      ...(update.kycTier !== undefined ? { kycTier: update.kycTier } : {}),
      ...(update.accountStatus !== undefined ? { accountStatus: update.accountStatus } : {}),
      ...(update.transactionLimit !== undefined ? { monthlyLimit: update.transactionLimit } : {}),
    };
    this.users = [
      ...this.users.slice(0, idx),
      updated,
      ...this.users.slice(idx + 1),
    ];
    return updated;
  }

  async listFxCorridors(): Promise<CorridorMarkupView[]> {
    return [...this.corridors];
  }

  async updateCorridorMarkup(corridorId: string, markupBps: number): Promise<CorridorMarkupView> {
    const idx = this.corridors.findIndex((c) => c.id === corridorId);
    if (idx === -1) throw new Error('Corridor not found');
    const updated = { ...this.corridors[idx], markupBps };
    this.corridors = [
      ...this.corridors.slice(0, idx),
      updated,
      ...this.corridors.slice(idx + 1),
    ];
    return updated;
  }

  async listFlaggedTransactions(filter: ListFlaggedFilter): Promise<Paginated<FlaggedTransaction>> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));

    let filtered = this.flaggedTransactions;
    if (filter.flagType) {
      filtered = filtered.filter((t) => t.flagReason === filter.flagType);
    }

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  async getCorridorMetrics(): Promise<CorridorMetrics[]> {
    return this.corridors.map((c) => ({
      corridorId: c.id,
      fromCurrency: c.fromCurrency,
      toCurrency: c.toCurrency,
      totalVolume: 0,
      transactionCount: 0,
      successRate: 1,
      avgProcessingTimeSec: 0,
    }));
  }
}
