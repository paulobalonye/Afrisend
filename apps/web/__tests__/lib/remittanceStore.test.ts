import { act, renderHook } from '@testing-library/react';
import { useRemittanceStore, selectTotalCost, selectIsReadyToSend } from '@/lib/store/remittanceStore';
import type { RateQuote, Corridor, Recipient } from '@/types';

const mockCorridor: Corridor = {
  id: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
  refreshIntervalSeconds: 60,
};

const mockQuote: RateQuote = {
  corridorId: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 145000,
  exchangeRate: 1450,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  quoteId: 'q-1',
};

const mockRecipient: Recipient = {
  id: 'r-1',
  userId: 'u-1',
  nickname: 'Mum',
  firstName: 'Grace',
  lastName: 'Adeyemi',
  country: 'NG',
  payoutMethod: 'bank_transfer',
  accountDetails: { accountNumber: '0123456789', bankCode: '058', bankName: 'GTBank' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useRemittanceStore', () => {
  beforeEach(() => {
    useRemittanceStore.setState({
      selectedCorridor: null,
      sourceAmount: '',
      currentQuote: null,
      recipient: null,
      currentPayment: null,
      isLoading: false,
      error: null,
    });
  });

  it('should initialise with empty flow state', () => {
    const { result } = renderHook(() => useRemittanceStore());
    expect(result.current.sourceAmount).toBe('');
    expect(result.current.currentQuote).toBeNull();
    expect(result.current.recipient).toBeNull();
  });

  it('should set corridor', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => result.current.setSelectedCorridor(mockCorridor));
    expect(result.current.selectedCorridor).toEqual(mockCorridor);
  });

  it('should set source amount and clear quote', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => result.current.setCurrentQuote(mockQuote));
    act(() => result.current.setSourceAmount('150'));
    expect(result.current.sourceAmount).toBe('150');
    expect(result.current.currentQuote).toBeNull(); // cleared on amount change
  });

  it('should set current quote', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => result.current.setCurrentQuote(mockQuote));
    expect(result.current.currentQuote).toEqual(mockQuote);
  });

  it('should set recipient', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => result.current.setRecipient(mockRecipient));
    expect(result.current.recipient).toEqual(mockRecipient);
  });

  it('should reset flow', () => {
    const { result } = renderHook(() => useRemittanceStore());
    act(() => {
      result.current.setSelectedCorridor(mockCorridor);
      result.current.setSourceAmount('100');
      result.current.setCurrentQuote(mockQuote);
      result.current.setRecipient(mockRecipient);
    });
    act(() => result.current.resetFlow());
    expect(result.current.sourceAmount).toBe('');
    expect(result.current.currentQuote).toBeNull();
    expect(result.current.recipient).toBeNull();
    expect(result.current.selectedCorridor).toBeNull();
  });
});

describe('selectTotalCost', () => {
  it('should return totalSourceAmount when quote exists', () => {
    const state = { currentQuote: mockQuote } as any;
    expect(selectTotalCost(state)).toBe(102.5);
  });

  it('should return null when no quote', () => {
    const state = { currentQuote: null } as any;
    expect(selectTotalCost(state)).toBeNull();
  });
});

describe('selectIsReadyToSend', () => {
  it('should be true when quote and recipient exist and not loading', () => {
    const state = { currentQuote: mockQuote, recipient: mockRecipient, isLoading: false } as any;
    expect(selectIsReadyToSend(state)).toBe(true);
  });

  it('should be false when loading', () => {
    const state = { currentQuote: mockQuote, recipient: mockRecipient, isLoading: true } as any;
    expect(selectIsReadyToSend(state)).toBe(false);
  });

  it('should be false when quote is missing', () => {
    const state = { currentQuote: null, recipient: mockRecipient, isLoading: false } as any;
    expect(selectIsReadyToSend(state)).toBe(false);
  });
});
