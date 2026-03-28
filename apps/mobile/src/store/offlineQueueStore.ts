import { create } from 'zustand';

export type QueuedTransaction = {
  id: string;
  idempotencyKey: string;
  corridorId: string;
  sendAmount: number;
  sendCurrency: string;
  recipientId: string;
  payoutMethod: 'mobile_money' | 'bank_transfer';
  queuedAt: string;
  retryCount: number;
};

type OfflineQueueState = {
  queue: QueuedTransaction[];
  isSyncing: boolean;
  lastSyncAt: string | null;
};

type OfflineQueueActions = {
  enqueue: (tx: QueuedTransaction) => void;
  dequeue: (id: string) => void;
  incrementRetry: (id: string) => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
  clearQueue: () => void;
};

export const useOfflineQueueStore = create<OfflineQueueState & OfflineQueueActions>((set, get) => ({
  queue: [],
  isSyncing: false,
  lastSyncAt: null,

  enqueue: (tx) => {
    const { queue } = get();
    const alreadyQueued = queue.some((q) => q.idempotencyKey === tx.idempotencyKey);
    if (alreadyQueued) return;
    set({ queue: [...queue, tx] });
  },

  dequeue: (id) =>
    set((state) => ({ queue: state.queue.filter((q) => q.id !== id) })),

  incrementRetry: (id) =>
    set((state) => ({
      queue: state.queue.map((q) =>
        q.id === id ? { ...q, retryCount: q.retryCount + 1 } : q,
      ),
    })),

  setSyncing: (isSyncing) => set({ isSyncing }),

  markSynced: () => set({ lastSyncAt: new Date().toISOString() }),

  clearQueue: () => set({ queue: [] }),
}));
