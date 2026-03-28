import { create } from 'zustand';
import type { Corridor, RateQuote, Recipient, Payment } from '@/types';

type RemittanceState = {
  selectedCorridor: Corridor | null;
  sourceAmount: string;
  currentQuote: RateQuote | null;
  recipient: Recipient | null;
  currentPayment: Payment | null;
  isLoading: boolean;
  error: string | null;
};

type RemittanceActions = {
  setSelectedCorridor: (corridor: Corridor | null) => void;
  setSourceAmount: (amount: string) => void;
  setCurrentQuote: (quote: RateQuote | null) => void;
  setRecipient: (recipient: Recipient | null) => void;
  setCurrentPayment: (payment: Payment | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetFlow: () => void;
};

const initialFlowState: RemittanceState = {
  selectedCorridor: null,
  sourceAmount: '',
  currentQuote: null,
  recipient: null,
  currentPayment: null,
  isLoading: false,
  error: null,
};

export const useRemittanceStore = create<RemittanceState & RemittanceActions>((set) => ({
  ...initialFlowState,

  setSelectedCorridor: (selectedCorridor) => set({ selectedCorridor }),

  setSourceAmount: (sourceAmount) => set({ sourceAmount, currentQuote: null }),

  setCurrentQuote: (currentQuote) => set({ currentQuote }),

  setRecipient: (recipient) => set({ recipient }),

  setCurrentPayment: (currentPayment) => set({ currentPayment }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  resetFlow: () => set({ ...initialFlowState }),
}));

export function selectTotalCost(state: RemittanceState): number | null {
  return state.currentQuote?.totalSourceAmount ?? null;
}

export function selectIsReadyToSend(state: RemittanceState): boolean {
  return state.currentQuote !== null && state.recipient !== null && !state.isLoading;
}
