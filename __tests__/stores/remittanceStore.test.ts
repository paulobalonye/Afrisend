import { useRemittanceStore, selectTotalCost, selectIsReadyToSend } from '../../src/store/remittanceStore';
import type { Corridor, RateQuote, Payment, Recipient } from '../../src/api/endpoints/yellowcard';

const mockCorridor: Corridor = {
  id: 'corridor-ng',
  sourceCurrency: 'USD',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
};

const mockQuote: RateQuote = {
  corridorId: 'corridor-ng',
  sourceCurrency: 'USD',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 152000,
  exchangeRate: 1520,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: '2026-03-28T13:00:00Z',
  quoteId: 'quote-abc123',
};

const mockPayment: Payment = {
  id: 'pay-xyz789',
  idempotencyKey: 'idem-key-1',
  corridorId: 'corridor-ng',
  sourceCurrency: 'USD',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 152000,
  exchangeRate: 1520,
  fee: 2.5,
  status: 'pending',
  recipient: {
    name: 'John Doe',
    accountNumber: '0123456789',
    bankCode: '058',
    bankName: 'GTBank',
  },
  createdAt: '2026-03-28T12:00:00Z',
  updatedAt: '2026-03-28T12:00:00Z',
};

const mockRecipient: Recipient = {
  name: 'John Doe',
  accountNumber: '0123456789',
  bankCode: '058',
  bankName: 'GTBank',
};

const initialState = {
  corridors: [],
  selectedCorridor: null,
  sourceAmount: '',
  currentQuote: null,
  recipient: null,
  currentPayment: null,
  paymentHistory: [],
  isLoading: false,
  error: null,
};

describe('useRemittanceStore', () => {
  beforeEach(() => {
    useRemittanceStore.setState(initialState);
  });

  it('starts with empty state', () => {
    const state = useRemittanceStore.getState();
    expect(state.corridors).toEqual([]);
    expect(state.selectedCorridor).toBeNull();
    expect(state.sourceAmount).toBe('');
    expect(state.currentQuote).toBeNull();
    expect(state.recipient).toBeNull();
    expect(state.currentPayment).toBeNull();
    expect(state.paymentHistory).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets corridors', () => {
    useRemittanceStore.getState().setCorridors([mockCorridor]);
    expect(useRemittanceStore.getState().corridors).toEqual([mockCorridor]);
  });

  it('sets selected corridor', () => {
    useRemittanceStore.getState().setSelectedCorridor(mockCorridor);
    expect(useRemittanceStore.getState().selectedCorridor).toEqual(mockCorridor);
  });

  it('sets source amount as string', () => {
    useRemittanceStore.getState().setSourceAmount('150.00');
    expect(useRemittanceStore.getState().sourceAmount).toBe('150.00');
  });

  it('sets current quote', () => {
    useRemittanceStore.getState().setCurrentQuote(mockQuote);
    expect(useRemittanceStore.getState().currentQuote).toEqual(mockQuote);
  });

  it('clears quote when source amount changes', () => {
    useRemittanceStore.getState().setCurrentQuote(mockQuote);
    useRemittanceStore.getState().setSourceAmount('200');
    expect(useRemittanceStore.getState().currentQuote).toBeNull();
  });

  it('sets recipient', () => {
    useRemittanceStore.getState().setRecipient(mockRecipient);
    expect(useRemittanceStore.getState().recipient).toEqual(mockRecipient);
  });

  it('sets current payment', () => {
    useRemittanceStore.getState().setCurrentPayment(mockPayment);
    expect(useRemittanceStore.getState().currentPayment).toEqual(mockPayment);
  });

  it('adds payment to history immutably', () => {
    useRemittanceStore.getState().addPaymentToHistory(mockPayment);
    const second = { ...mockPayment, id: 'pay-2' };
    useRemittanceStore.getState().addPaymentToHistory(second);

    const history = useRemittanceStore.getState().paymentHistory;
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('pay-xyz789');
    expect(history[1].id).toBe('pay-2');
  });

  it('updates payment status in history immutably', () => {
    useRemittanceStore.getState().addPaymentToHistory(mockPayment);
    useRemittanceStore.getState().updatePaymentStatus('pay-xyz789', 'completed');

    const updated = useRemittanceStore.getState().paymentHistory.find((p) => p.id === 'pay-xyz789');
    expect(updated?.status).toBe('completed');
    // Original object should not be mutated
    expect(mockPayment.status).toBe('pending');
  });

  it('does not update other payments when updating status', () => {
    const second = { ...mockPayment, id: 'pay-2', status: 'pending' as const };
    useRemittanceStore.getState().addPaymentToHistory(mockPayment);
    useRemittanceStore.getState().addPaymentToHistory(second);
    useRemittanceStore.getState().updatePaymentStatus('pay-xyz789', 'completed');

    const secondPayment = useRemittanceStore.getState().paymentHistory.find((p) => p.id === 'pay-2');
    expect(secondPayment?.status).toBe('pending');
  });

  it('sets loading state', () => {
    useRemittanceStore.getState().setLoading(true);
    expect(useRemittanceStore.getState().isLoading).toBe(true);
    useRemittanceStore.getState().setLoading(false);
    expect(useRemittanceStore.getState().isLoading).toBe(false);
  });

  it('sets and clears error', () => {
    useRemittanceStore.getState().setError('Payment failed');
    expect(useRemittanceStore.getState().error).toBe('Payment failed');
    useRemittanceStore.getState().setError(null);
    expect(useRemittanceStore.getState().error).toBeNull();
  });

  it('resets flow state without clearing history and corridors', () => {
    useRemittanceStore.getState().setCorridors([mockCorridor]);
    useRemittanceStore.getState().setSelectedCorridor(mockCorridor);
    useRemittanceStore.getState().setCurrentQuote(mockQuote);
    useRemittanceStore.getState().setRecipient(mockRecipient);
    useRemittanceStore.getState().addPaymentToHistory(mockPayment);

    useRemittanceStore.getState().resetFlow();

    const state = useRemittanceStore.getState();
    expect(state.selectedCorridor).toBeNull();
    expect(state.sourceAmount).toBe('');
    expect(state.currentQuote).toBeNull();
    expect(state.recipient).toBeNull();
    expect(state.currentPayment).toBeNull();
    expect(state.error).toBeNull();
    // These should be preserved
    expect(state.corridors).toHaveLength(1);
    expect(state.paymentHistory).toHaveLength(1);
  });
});

describe('selectTotalCost', () => {
  beforeEach(() => {
    useRemittanceStore.setState(initialState);
  });

  it('returns null when no quote is set', () => {
    expect(selectTotalCost(useRemittanceStore.getState())).toBeNull();
  });

  it('returns totalSourceAmount from quote', () => {
    useRemittanceStore.setState({ ...initialState, currentQuote: mockQuote });
    expect(selectTotalCost(useRemittanceStore.getState())).toBe(102.5);
  });
});

describe('selectIsReadyToSend', () => {
  beforeEach(() => {
    useRemittanceStore.setState(initialState);
  });

  it('returns false when no quote', () => {
    useRemittanceStore.setState({ ...initialState, recipient: mockRecipient });
    expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(false);
  });

  it('returns false when no recipient', () => {
    useRemittanceStore.setState({ ...initialState, currentQuote: mockQuote });
    expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(false);
  });

  it('returns false when loading', () => {
    useRemittanceStore.setState({
      ...initialState,
      currentQuote: mockQuote,
      recipient: mockRecipient,
      isLoading: true,
    });
    expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(false);
  });

  it('returns true when quote, recipient set and not loading', () => {
    useRemittanceStore.setState({
      ...initialState,
      currentQuote: mockQuote,
      recipient: mockRecipient,
      isLoading: false,
    });
    expect(selectIsReadyToSend(useRemittanceStore.getState())).toBe(true);
  });
});
