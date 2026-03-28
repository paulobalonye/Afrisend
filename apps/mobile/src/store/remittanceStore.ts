import { create } from 'zustand';
import type { Corridor, RateQuote, Payment, PaymentStatus, Recipient } from '@/api/endpoints/yellowcard';

type RemittanceState = {
  corridors: Corridor[];
  selectedCorridor: Corridor | null;
  sourceAmount: string;
  currentQuote: RateQuote | null;
  recipient: Recipient | null;
  currentPayment: Payment | null;
  paymentHistory: Payment[];
  isLoading: boolean;
  error: string | null;
};

type RemittanceActions = {
  setCorridors: (corridors: Corridor[]) => void;
  setSelectedCorridor: (corridor: Corridor | null) => void;
  setSourceAmount: (amount: string) => void;
  setCurrentQuote: (quote: RateQuote | null) => void;
  setRecipient: (recipient: Recipient | null) => void;
  setCurrentPayment: (payment: Payment | null) => void;
  addPaymentToHistory: (payment: Payment) => void;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetFlow: () => void;
};

const initialFlowState = {
  selectedCorridor: null,
  sourceAmount: '',
  currentQuote: null,
  recipient: null,
  currentPayment: null,
  isLoading: false,
  error: null,
};

export const useRemittanceStore = create<RemittanceState & RemittanceActions>((set) => ({
  corridors: [],
  paymentHistory: [],
  ...initialFlowState,

  setCorridors: (corridors) => set({ corridors }),

  setSelectedCorridor: (selectedCorridor) => set({ selectedCorridor }),

  setSourceAmount: (sourceAmount) => set({ sourceAmount, currentQuote: null }),

  setCurrentQuote: (currentQuote) => set({ currentQuote }),

  setRecipient: (recipient) => set({ recipient }),

  setCurrentPayment: (currentPayment) => set({ currentPayment }),

  addPaymentToHistory: (payment) =>
    set((state) => ({ paymentHistory: [...state.paymentHistory, payment] })),

  updatePaymentStatus: (paymentId, status) =>
    set((state) => ({
      paymentHistory: state.paymentHistory.map((p) =>
        p.id === paymentId ? { ...p, status } : p,
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  resetFlow: () => set({ ...initialFlowState }),
}));

// ─── Derived Selectors ────────────────────────────────────────────────────────

export function selectTotalCost(state: RemittanceState): number | null {
  return state.currentQuote?.totalSourceAmount ?? null;
}

export function selectIsReadyToSend(state: RemittanceState): boolean {
  return state.currentQuote !== null && state.recipient !== null && !state.isLoading;
}
