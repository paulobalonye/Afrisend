import { renderHook, act } from '@testing-library/react';
import { useQuoteCountdown } from '@/hooks/useQuoteCountdown';

describe('useQuoteCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial seconds from expiresAt', () => {
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));
    expect(result.current.seconds).toBeGreaterThan(55);
    expect(result.current.seconds).toBeLessThanOrEqual(60);
  });

  it('should countdown each second', () => {
    const expiresAt = new Date(Date.now() + 10000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));
    const initial = result.current.seconds;

    act(() => { jest.advanceTimersByTime(3000); });

    expect(result.current.seconds).toBeLessThanOrEqual(initial - 2);
  });

  it('should set isExpired when countdown hits 0', () => {
    const expiresAt = new Date(Date.now() + 2000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    act(() => { jest.advanceTimersByTime(3000); });

    expect(result.current.seconds).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('should format time correctly', () => {
    const expiresAt = new Date(Date.now() + 65000).toISOString();
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));
    // Should be "1:05" format
    expect(result.current.formattedTime).toMatch(/^\d+:\d{2}$/);
  });

  it('should return zeros when expiresAt is null', () => {
    const { result } = renderHook(() => useQuoteCountdown(null));
    expect(result.current.seconds).toBe(0);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.formattedTime).toBe('0:00');
  });
});
