/**
 * Unit tests for TransactionService (in-memory sandbox implementation).
 * Follows TDD: tests are written before the implementation.
 */

import {
  DefaultTransactionService,
  TransactionStatus,
  type InitiateTransactionInput,
} from '@/server/services/transactionService';

const BASE_INPUT: InitiateTransactionInput = {
  userId: 'user-abc',
  recipientId: 'recipient-xyz',
  idempotencyKey: 'idem-001',
  amount: 100,
  currency: 'USDC',
  targetAmount: 75000,
  targetCurrency: 'NGN',
  fxRate: 750,
  payoutRail: 'yellowcard',
  quoteId: 'quote-001',
  corridorId: 'cor-ng',
};

describe('DefaultTransactionService', () => {
  let service: DefaultTransactionService;

  beforeEach(() => {
    service = new DefaultTransactionService();
  });

  // ─── initiate ────────────────────────────────────────────────────────────

  describe('initiate', () => {
    it('creates a transaction in pending status', async () => {
      const tx = await service.initiate(BASE_INPUT);

      expect(tx.id).toBeTruthy();
      expect(tx.status).toBe(TransactionStatus.Pending);
      expect(tx.userId).toBe('user-abc');
      expect(tx.amount).toBe(100);
      expect(tx.currency).toBe('USDC');
      expect(tx.targetAmount).toBe(75000);
      expect(tx.targetCurrency).toBe('NGN');
      expect(tx.fxRate).toBe(750);
      expect(tx.retryCount).toBe(0);
      expect(tx.createdAt).toBeInstanceOf(Date);
      expect(tx.updatedAt).toBeInstanceOf(Date);
    });

    it('records a transaction_created event', async () => {
      const tx = await service.initiate(BASE_INPUT);
      const events = await service.getEvents(tx.id);

      expect(events).toHaveLength(1);
      expect(events[0].toStatus).toBe(TransactionStatus.Pending);
      expect(events[0].fromStatus).toBeNull();
      expect(events[0].actor).toBe('system');
    });

    it('is idempotent: same idempotency key returns same transaction', async () => {
      const tx1 = await service.initiate(BASE_INPUT);
      const tx2 = await service.initiate({ ...BASE_INPUT, amount: 999 });

      expect(tx2.id).toBe(tx1.id);
      expect(tx2.amount).toBe(100); // original amount preserved
    });

    it('allows different idempotency keys for same user', async () => {
      const tx1 = await service.initiate(BASE_INPUT);
      const tx2 = await service.initiate({ ...BASE_INPUT, idempotencyKey: 'idem-002' });

      expect(tx2.id).not.toBe(tx1.id);
    });

    it('rejects amount <= 0', async () => {
      await expect(service.initiate({ ...BASE_INPUT, amount: 0 })).rejects.toThrow();
      await expect(service.initiate({ ...BASE_INPUT, amount: -5 })).rejects.toThrow();
    });

    it('rejects missing userId', async () => {
      await expect(service.initiate({ ...BASE_INPUT, userId: '' })).rejects.toThrow();
    });
  });

  // ─── get ─────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns transaction by id for the owning user', async () => {
      const created = await service.initiate(BASE_INPUT);
      const fetched = await service.get(created.id, 'user-abc');

      expect(fetched.id).toBe(created.id);
    });

    it('throws not-found for unknown transaction id', async () => {
      await expect(service.get('nonexistent-id', 'user-abc')).rejects.toThrow(/not found/i);
    });

    it('throws not-found when userId does not match', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await expect(service.get(tx.id, 'other-user')).rejects.toThrow(/not found/i);
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns empty list when user has no transactions', async () => {
      const result = await service.list('user-none', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns only the requesting user\'s transactions', async () => {
      await service.initiate({ ...BASE_INPUT, userId: 'user-1', idempotencyKey: 'k1' });
      await service.initiate({ ...BASE_INPUT, userId: 'user-2', idempotencyKey: 'k2' });

      const result = await service.list('user-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-1');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        await service.initiate({ ...BASE_INPUT, idempotencyKey: `key-${i}` });
      }

      const page1 = await service.list('user-abc', { page: 1, limit: 3 });
      const page2 = await service.list('user-abc', { page: 2, limit: 3 });

      expect(page1.data).toHaveLength(3);
      expect(page2.data).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it('returns correct pagination metadata', async () => {
      await service.initiate(BASE_INPUT);

      const result = await service.list('user-abc', { page: 1, limit: 10 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(1);
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels a pending transaction', async () => {
      const tx = await service.initiate(BASE_INPUT);
      const cancelled = await service.cancel(tx.id, 'user-abc');

      expect(cancelled.status).toBe(TransactionStatus.Cancelled);
    });

    it('records a cancelled event', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.cancel(tx.id, 'user-abc');
      const events = await service.getEvents(tx.id);

      const cancelEvent = events.find(e => e.toStatus === TransactionStatus.Cancelled);
      expect(cancelEvent).toBeDefined();
      expect(cancelEvent?.fromStatus).toBe(TransactionStatus.Pending);
    });

    it('throws if transaction is not pending', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);

      await expect(service.cancel(tx.id, 'user-abc')).rejects.toThrow(/cannot cancel/i);
    });

    it('throws not-found when userId does not match', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await expect(service.cancel(tx.id, 'wrong-user')).rejects.toThrow(/not found/i);
    });
  });

  // ─── state machine / transitionTo ─────────────────────────────────────────

  describe('transitionTo (state machine)', () => {
    it('pending → processing', async () => {
      const tx = await service.initiate(BASE_INPUT);
      const updated = await service.transitionTo(tx.id, TransactionStatus.Processing);
      expect(updated.status).toBe(TransactionStatus.Processing);
    });

    it('processing → completed', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      const updated = await service.transitionTo(tx.id, TransactionStatus.Completed);
      expect(updated.status).toBe(TransactionStatus.Completed);
    });

    it('processing → failed', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      const updated = await service.transitionTo(tx.id, TransactionStatus.Failed, { reason: 'payout timeout' });
      expect(updated.status).toBe(TransactionStatus.Failed);
      expect(updated.failureReason).toBe('payout timeout');
    });

    it('processing → reversed', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      const updated = await service.transitionTo(tx.id, TransactionStatus.Reversed);
      expect(updated.status).toBe(TransactionStatus.Reversed);
    });

    it('rejects invalid transition: completed → processing', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Completed);

      await expect(
        service.transitionTo(tx.id, TransactionStatus.Processing)
      ).rejects.toThrow(/invalid.*transition/i);
    });

    it('rejects invalid transition: failed → completed', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Failed);

      await expect(
        service.transitionTo(tx.id, TransactionStatus.Completed)
      ).rejects.toThrow(/invalid.*transition/i);
    });

    it('logs an event for each transition', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Completed);

      const events = await service.getEvents(tx.id);
      expect(events).toHaveLength(3); // created + processing + completed
    });
  });

  // ─── retry logic ──────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('increments retry count on each retry attempt', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Failed);

      const retried = await service.retry(tx.id);
      expect(retried.retryCount).toBe(1);
      expect(retried.status).toBe(TransactionStatus.Processing);
    });

    it('allows up to 3 retries', async () => {
      const tx = await service.initiate(BASE_INPUT);
      // First cycle: pending → processing → failed → retry (back to processing)
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Failed);
      await service.retry(tx.id);

      // Subsequent cycles: retry already set status to processing, so go to failed → retry
      for (let i = 1; i < 3; i++) {
        await service.transitionTo(tx.id, TransactionStatus.Failed);
        await service.retry(tx.id);
      }

      const final = await service.get(tx.id, 'user-abc');
      expect(final.retryCount).toBe(3);
    });

    it('throws after max 3 retries exceeded', async () => {
      const tx = await service.initiate(BASE_INPUT);
      // First cycle
      await service.transitionTo(tx.id, TransactionStatus.Processing);
      await service.transitionTo(tx.id, TransactionStatus.Failed);
      await service.retry(tx.id);

      // Cycles 2-3
      for (let i = 1; i < 3; i++) {
        await service.transitionTo(tx.id, TransactionStatus.Failed);
        await service.retry(tx.id);
      }

      // 4th retry should be rejected
      await service.transitionTo(tx.id, TransactionStatus.Failed);
      await expect(service.retry(tx.id)).rejects.toThrow(/max retries/i);
    });

    it('cannot retry a non-failed transaction', async () => {
      const tx = await service.initiate(BASE_INPUT);
      await expect(service.retry(tx.id)).rejects.toThrow(/can only retry failed/i);
    });
  });
});
