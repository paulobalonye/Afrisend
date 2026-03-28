import { renderHook, act } from '@testing-library/react-hooks';
import {
  useRemittanceStore,
  selectTotalCost,
  selectIsReadyToSend,
} from '../remittanceStore';
import type { RateQuote, Payment } from '@/api/endpoints/yellowcard';

const mockQuote: RateQuote = {
  corridorId: 'c1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 180000,
  exchangeRate: 1800,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  quoteId: 'q1',
};

const mockRecipient = {
  name: 'John Doe',
  accountNumber: '1234567890',
  bankCode: 'GTB',
  bankName: 'GTBank',
};

const mockPayment: Payment = {
  id: 'pay-1',
  idempotencyKey: 'idem-1',
  corridorId: 'c1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 180000,
  exchangeRate: 1800,
  fee: 2.5,
  status: 'pending',
  recipient: mockRecipient,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('remittanceStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useRemittanceStore.getState().resetFlow();
    });
  });

  it('initialises with empty state', () => {
    const { result } = renderHook(() => useRemittanceStore());
    expect(result.current.corridors).toEqual([]);
    expect(result.current.selectedCorridor).toBeNull();
    expect(result.current.sourceAmount).toBe('');
    expect(result.current.currentQuote).toBeNull();
    expect(result.current.recipient).toBeNull();
    expect(result.current.currentPayment).toBeNull();
    expect(result.current.paymentHistory).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('setSourceAmount clears quote', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => {
      result.current.setCurrentQuote(mockQuote);
      result.current.setSourceAmount('200');
    });
    expect(result.current.sourceAmount).toBe('200');
    expect(result.current.currentQuote).toBeNull();
  });

  it('addPaymentToHistory appends immutably', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => {
      result.current.addPaymentToHistory(mockPayment);
    });
    expect(result.current.paymentHistory).toHaveLength(1);
    expect(result.current.paymentHistory[0]).toEqual(mockPayment);
  });

  it('updatePaymentStatus updates status without mutation', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => {
      result.current.addPaymentToHistory(mockPayment);
      result.current.updatePaymentStatus('pay-1', 'completed');
    });
    expect(result.current.paymentHistory[0].status).toBe('completed');
    // original mock object should not be mutated
    expect(mockPayment.status).toBe('pending');
  });

  it('resetFlow clears flow state but keeps corridors and history', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => {
      result.current.setSourceAmount('100');
      result.current.setCurrentQuote(mockQuote);
      result.current.setRecipient(mockRecipient);
      result.current.addPaymentToHistory(mockPayment);
      result.current.resetFlow();
    });
    expect(result.current.sourceAmount).toBe('');
    expect(result.current.currentQuote).toBeNull();
    expect(result.current.recipient).toBeNull();
    // History persists after resetFlow
    expect(result.current.paymentHistory).toHaveLength(1);
  });

  describe('selectTotalCost', () => {
    it('returns null when no quote', () => {
      const state = useRemittanceStore.getState();
      expect(selectTotalCost(state)).toBeNull();
    });

    it('returns totalSourceAmount from quote', () => {
      act(() => {
        useRemittanceStore.getState().setCurrentQuote(mockQuote);
      });
      const state = useRemittanceStore.getState();
      expect(selectTotalCost(state)).toBe(102.5);
    });
  });

  describe('selectIsReadyToSend', () => {
    it('returns false when no quote and no recipient', () => {
      const state = useRemittanceStore.getState();
      expect(selectIsReadyToSend(state)).toBe(false);
    });

    it('returns false when quote present but no recipient', () => {
      act(() => {
        useRemittanceStore.getState().setCurrentQuote(mockQuote);
      });
      expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(false);
    });

    it('returns true when quote and recipient are set and not loading', () => {
      act(() => {
        useRemittanceStore.getState().setCurrentQuote(mockQuote);
        useRemittanceStore.getState().setRecipient(mockRecipient);
      });
      expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(true);
    });

    it('returns false when loading', () => {
      act(() => {
        useRemittanceStore.getState().setCurrentQuote(mockQuote);
        useRemittanceStore.getState().setRecipient(mockRecipient);
        useRemittanceStore.getState().setLoading(true);
      });
      expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(false);
    });
  });
});
