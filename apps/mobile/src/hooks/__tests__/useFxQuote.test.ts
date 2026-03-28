import { renderHook, act } from '@testing-library/react-hooks';
import { useFxQuote } from '../useFxQuote';
import * as yellowcard from '@/api/endpoints/yellowcard';

jest.mock('@/api/endpoints/yellowcard');

const mockQuote = {
  corridorId: 'corridor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 180000,
  exchangeRate: 1800,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  quoteId: 'quote-123',
};

describe('useFxQuote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (yellowcard.getRates as jest.Mock).mockResolvedValue(mockQuote);
  });

  it('returns null quote initially', () => {
    const { result } = renderHook(() =>
      useFxQuote({ corridorId: '', sourceAmount: 0, enabled: false }),
    );
    expect(result.current.quote).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches quote when enabled and corridorId + sourceAmount are provided', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useFxQuote({ corridorId: 'corridor-1', sourceAmount: 100, enabled: true }),
    );

    expect(result.current.isLoading).toBe(true);
    await waitForNextUpdate();

    expect(yellowcard.getRates).toHaveBeenCalledWith({
      corridorId: 'corridor-1',
      sourceAmount: 100,
    });
    expect(result.current.quote).toEqual(mockQuote);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when disabled', async () => {
    renderHook(() =>
      useFxQuote({ corridorId: 'corridor-1', sourceAmount: 100, enabled: false }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(yellowcard.getRates).not.toHaveBeenCalled();
  });

  it('does not fetch when sourceAmount is 0', async () => {
    renderHook(() =>
      useFxQuote({ corridorId: 'corridor-1', sourceAmount: 0, enabled: true }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(yellowcard.getRates).not.toHaveBeenCalled();
  });

  it('sets error on fetch failure', async () => {
    (yellowcard.getRates as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result, waitForNextUpdate } = renderHook(() =>
      useFxQuote({ corridorId: 'corridor-1', sourceAmount: 100, enabled: true }),
    );

    await waitForNextUpdate();

    expect(result.current.quote).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('exposes a refresh function that re-fetches the quote', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useFxQuote({ corridorId: 'corridor-1', sourceAmount: 100, enabled: true }),
    );
    await waitForNextUpdate();
    expect(yellowcard.getRates).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });
    await waitForNextUpdate();
    expect(yellowcard.getRates).toHaveBeenCalledTimes(2);
  });
});
