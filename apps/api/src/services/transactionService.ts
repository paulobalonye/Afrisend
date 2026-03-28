/**
 * Transaction Service — send money flow, state machine, retry logic.
 *
 * Implements an in-memory sandbox; swap with a database-backed implementation
 * for production.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export enum TransactionStatus {
  Pending    = 'pending',
  Processing = 'processing',
  Completed  = 'completed',
  Failed     = 'failed',
  Reversed   = 'reversed',
  Cancelled  = 'cancelled',
}

export type Transaction = {
  id: string;
  userId: string;
  recipientId: string | null;
  idempotencyKey: string;
  amount: number;
  currency: string;
  targetAmount: number;
  targetCurrency: string;
  fxRate: number;
  status: TransactionStatus;
  payoutRail: string | null;
  payoutReference: string | null;
  retryCount: number;
  failureReason: string | null;
  quoteId: string | null;
  corridorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionEvent = {
  id: string;
  transactionId: string;
  fromStatus: TransactionStatus | null;
  toStatus: TransactionStatus;
  actor: string;
  note: string | null;
  createdAt: Date;
};

export type InitiateTransactionInput = {
  userId: string;
  recipientId?: string | null;
  idempotencyKey: string;
  amount: number;
  currency: string;
  targetAmount: number;
  targetCurrency: string;
  fxRate: number;
  payoutRail?: string | null;
  quoteId?: string | null;
  corridorId?: string | null;
};

export type PaginationInput = {
  page: number;
  limit: number;
};

export type PaginatedTransactions = {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
};

export type TransitionOptions = {
  reason?: string;
  actor?: string;
  note?: string;
};

// ─── State machine allowed transitions ───────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  [TransactionStatus.Pending]:    [TransactionStatus.Processing, TransactionStatus.Cancelled],
  [TransactionStatus.Processing]: [TransactionStatus.Completed, TransactionStatus.Failed, TransactionStatus.Reversed],
  [TransactionStatus.Completed]:  [],
  [TransactionStatus.Failed]:     [],
  [TransactionStatus.Reversed]:   [],
  [TransactionStatus.Cancelled]:  [],
};

const MAX_RETRIES = 3;

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ITransactionService {
  initiate(input: InitiateTransactionInput): Promise<Transaction>;
  get(transactionId: string, userId: string): Promise<Transaction>;
  list(userId: string, pagination: PaginationInput): Promise<PaginatedTransactions>;
  cancel(transactionId: string, userId: string): Promise<Transaction>;
  transitionTo(transactionId: string, status: TransactionStatus, opts?: TransitionOptions): Promise<Transaction>;
  getEvents(transactionId: string): Promise<TransactionEvent[]>;
  retry(transactionId: string): Promise<Transaction>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── In-memory sandbox implementation ────────────────────────────────────────

export class DefaultTransactionService implements ITransactionService {
  private readonly transactions = new Map<string, Transaction>();
  /** key: `${userId}:${idempotencyKey}` → transactionId */
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly events = new Map<string, TransactionEvent[]>();

  async initiate(input: InitiateTransactionInput): Promise<Transaction> {
    if (!input.userId) {
      throw new Error('userId is required');
    }
    if (typeof input.amount !== 'number' || input.amount <= 0) {
      throw new Error('amount must be a positive number');
    }

    // Idempotency check
    const idempotencyIndexKey = `${input.userId}:${input.idempotencyKey}`;
    const existingId = this.idempotencyIndex.get(idempotencyIndexKey);
    if (existingId) {
      const existing = this.transactions.get(existingId);
      if (existing) return existing;
    }

    const now = new Date();
    const tx: Transaction = {
      id: generateId('tx'),
      userId: input.userId,
      recipientId: input.recipientId ?? null,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      currency: input.currency,
      targetAmount: input.targetAmount,
      targetCurrency: input.targetCurrency,
      fxRate: input.fxRate,
      status: TransactionStatus.Pending,
      payoutRail: input.payoutRail ?? null,
      payoutReference: null,
      retryCount: 0,
      failureReason: null,
      quoteId: input.quoteId ?? null,
      corridorId: input.corridorId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.transactions.set(tx.id, tx);
    this.idempotencyIndex.set(idempotencyIndexKey, tx.id);
    this.events.set(tx.id, []);

    this._appendEvent(tx.id, null, TransactionStatus.Pending, 'system', 'transaction created');

    return tx;
  }

  async get(transactionId: string, userId: string): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.userId !== userId) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    return tx;
  }

  async list(userId: string, pagination: PaginationInput): Promise<PaginatedTransactions> {
    const all = Array.from(this.transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = all.length;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const data = all.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  async cancel(transactionId: string, userId: string): Promise<Transaction> {
    const tx = await this.get(transactionId, userId);

    if (tx.status !== TransactionStatus.Pending) {
      throw new Error(`Cannot cancel a ${tx.status} transaction`);
    }

    return this.transitionTo(transactionId, TransactionStatus.Cancelled, { actor: userId });
  }

  async transitionTo(
    transactionId: string,
    toStatus: TransactionStatus,
    opts: TransitionOptions = {},
  ): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const allowed = ALLOWED_TRANSITIONS[tx.status];
    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Invalid status transition: ${tx.status} → ${toStatus}`
      );
    }

    const fromStatus = tx.status;
    const updated: Transaction = {
      ...tx,
      status: toStatus,
      failureReason: opts.reason ?? (toStatus === TransactionStatus.Failed ? tx.failureReason : null),
      updatedAt: new Date(),
    };

    if (opts.reason && toStatus === TransactionStatus.Failed) {
      updated.failureReason = opts.reason;
    }

    this.transactions.set(transactionId, updated);
    this._appendEvent(transactionId, fromStatus, toStatus, opts.actor ?? 'system', opts.note ?? null);

    return updated;
  }

  async getEvents(transactionId: string): Promise<TransactionEvent[]> {
    return this.events.get(transactionId) ?? [];
  }

  async retry(transactionId: string): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    if (tx.status !== TransactionStatus.Failed) {
      throw new Error('Can only retry failed transactions');
    }
    if (tx.retryCount >= MAX_RETRIES) {
      throw new Error(`Max retries (${MAX_RETRIES}) exceeded for transaction ${transactionId}`);
    }

    const updated: Transaction = {
      ...tx,
      status: TransactionStatus.Processing,
      retryCount: tx.retryCount + 1,
      failureReason: null,
      updatedAt: new Date(),
    };

    this.transactions.set(transactionId, updated);
    this._appendEvent(transactionId, TransactionStatus.Failed, TransactionStatus.Processing, 'system', `retry attempt ${updated.retryCount}`);

    return updated;
  }

  private _appendEvent(
    transactionId: string,
    fromStatus: TransactionStatus | null,
    toStatus: TransactionStatus,
    actor: string,
    note: string | null,
  ): void {
    const events = this.events.get(transactionId) ?? [];
    events.push({
      id: generateId('evt'),
      transactionId,
      fromStatus,
      toStatus,
      actor,
      note,
      createdAt: new Date(),
    });
    this.events.set(transactionId, events);
  }
}
