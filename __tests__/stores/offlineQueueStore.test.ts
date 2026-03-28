import { act } from '@testing-library/react-hooks';
import {
  useOfflineQueueStore,
  type QueuedTransaction,
} from '@/store/offlineQueueStore';

// Reset Zustand store between tests
beforeEach(() => {
  useOfflineQueueStore.setState({
    queue: [],
    isSyncing: false,
    lastSyncAt: null,
  });
});

const makeTx = (overrides?: Partial<QueuedTransaction>): QueuedTransaction => ({
  id: 'tx-001',
  idempotencyKey: 'key-001',
  corridorId: 'corridor-ng',
  sendAmount: 5000,
  sendCurrency: 'GBP',
  recipientId: 'recipient-001',
  payoutMethod: 'mobile_money',
  queuedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  retryCount: 0,
  ...overrides,
});

describe('offlineQueueStore', () => {
  describe('enqueue', () => {
    it('adds a transaction to the queue', () => {
      const tx = makeTx();
      useOfflineQueueStore.getState().enqueue(tx);
      expect(useOfflineQueueStore.getState().queue).toHaveLength(1);
      expect(useOfflineQueueStore.getState().queue[0]).toEqual(tx);
    });

    it('does not mutate existing queue entries when adding', () => {
      const tx1 = makeTx({ id: 'tx-001' });
      const tx2 = makeTx({ id: 'tx-002', idempotencyKey: 'key-002' });
      useOfflineQueueStore.getState().enqueue(tx1);
      const queueAfterFirst = useOfflineQueueStore.getState().queue;
      useOfflineQueueStore.getState().enqueue(tx2);
      // Original reference should be unchanged
      expect(queueAfterFirst).toHaveLength(1);
    });

    it('rejects duplicate idempotency keys', () => {
      const tx = makeTx();
      useOfflineQueueStore.getState().enqueue(tx);
      useOfflineQueueStore.getState().enqueue(tx); // same idempotencyKey
      expect(useOfflineQueueStore.getState().queue).toHaveLength(1);
    });
  });

  describe('dequeue', () => {
    it('removes a transaction by id', () => {
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-001' }));
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-002', idempotencyKey: 'key-002' }));
      useOfflineQueueStore.getState().dequeue('tx-001');
      expect(useOfflineQueueStore.getState().queue).toHaveLength(1);
      expect(useOfflineQueueStore.getState().queue[0].id).toBe('tx-002');
    });

    it('does nothing when id is not found', () => {
      useOfflineQueueStore.getState().enqueue(makeTx());
      useOfflineQueueStore.getState().dequeue('nonexistent');
      expect(useOfflineQueueStore.getState().queue).toHaveLength(1);
    });
  });

  describe('incrementRetry', () => {
    it('increments retry count for the given transaction', () => {
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-001', retryCount: 0 }));
      useOfflineQueueStore.getState().incrementRetry('tx-001');
      expect(useOfflineQueueStore.getState().queue[0].retryCount).toBe(1);
    });

    it('does not mutate other queue entries', () => {
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-001', retryCount: 0 }));
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-002', idempotencyKey: 'key-002', retryCount: 0 }));
      useOfflineQueueStore.getState().incrementRetry('tx-001');
      expect(useOfflineQueueStore.getState().queue[1].retryCount).toBe(0);
    });
  });

  describe('setSyncing', () => {
    it('sets isSyncing to true', () => {
      useOfflineQueueStore.getState().setSyncing(true);
      expect(useOfflineQueueStore.getState().isSyncing).toBe(true);
    });

    it('sets isSyncing to false', () => {
      useOfflineQueueStore.getState().setSyncing(true);
      useOfflineQueueStore.getState().setSyncing(false);
      expect(useOfflineQueueStore.getState().isSyncing).toBe(false);
    });
  });

  describe('markSynced', () => {
    it('updates lastSyncAt timestamp', () => {
      const before = Date.now();
      useOfflineQueueStore.getState().markSynced();
      const after = Date.now();
      const syncedAt = useOfflineQueueStore.getState().lastSyncAt;
      expect(syncedAt).not.toBeNull();
      const syncedMs = new Date(syncedAt!).getTime();
      expect(syncedMs).toBeGreaterThanOrEqual(before);
      expect(syncedMs).toBeLessThanOrEqual(after);
    });
  });

  describe('clearQueue', () => {
    it('removes all queued transactions', () => {
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-001' }));
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-002', idempotencyKey: 'key-002' }));
      useOfflineQueueStore.getState().clearQueue();
      expect(useOfflineQueueStore.getState().queue).toHaveLength(0);
    });
  });

  describe('selectors', () => {
    it('queueLength returns correct count', () => {
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-001' }));
      useOfflineQueueStore.getState().enqueue(makeTx({ id: 'tx-002', idempotencyKey: 'key-002' }));
      expect(useOfflineQueueStore.getState().queue).toHaveLength(2);
    });

    it('hasQueuedItems returns false when empty', () => {
      expect(useOfflineQueueStore.getState().queue).toHaveLength(0);
    });
  });
});
