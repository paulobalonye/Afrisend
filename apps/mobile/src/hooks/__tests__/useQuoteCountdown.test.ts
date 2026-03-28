import { renderHook, act } from '@testing-library/react-hooks';
import { useQuoteCountdown } from '../useQuoteCountdown';

describe('useQuoteCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 seconds remaining when expiresAt is null', () => {
    const { result } = renderHook(() => useQuoteCountdown(null));
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('returns correct seconds remaining for a future expiry', () => {
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    // Allow for small timing drift
    expect(result.current.secondsRemaining).toBeGreaterThanOrEqual(28);
    expect(result.current.secondsRemaining).toBeLessThanOrEqual(30);
    expect(result.current.isExpired).toBe(false);
  });

  it('counts down each second', () => {
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    const initial = result.current.secondsRemaining;

    act(() => {
      jest.advanceTimersByTime(3_000);
    });

    expect(result.current.secondsRemaining).toBeLessThanOrEqual(initial - 2);
  });

  it('sets isExpired to true when countdown reaches 0', () => {
    const expiresAt = new Date(Date.now() + 2_000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('returns a formatted time string', () => {
    const expiresAt = new Date(Date.now() + 900_000).toISOString(); // 15 min
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));
    expect(result.current.formattedTime).toMatch(/^\d{1,2}:\d{2}$/);
  });
});
