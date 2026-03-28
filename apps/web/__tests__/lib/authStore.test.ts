import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '@/lib/store/authStore';

// Mock cookie storage
jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn(),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

import * as cookies from '@/lib/auth/cookies';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  phone: '+44123456789',
  firstName: 'Test',
  lastName: 'User',
  kycStatus: 'approved' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      temporaryToken: null,
      pendingPhone: null,
    });
    jest.clearAllMocks();
  });

  it('should initialise with unknown status and no user', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.status).toBe('unknown');
    expect(result.current.user).toBeNull();
  });

  it('should set user and mark as authenticated', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setUser(mockUser));
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.status).toBe('authenticated');
  });

  it('should set status', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setStatus('unauthenticated'));
    expect(result.current.status).toBe('unauthenticated');
  });

  it('should store temporaryToken for OTP flow', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setTemporaryToken('tmp-token-123'));
    expect(result.current.temporaryToken).toBe('tmp-token-123');
  });

  it('should store pendingPhone', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setPendingPhone('+44123456789'));
    expect(result.current.pendingPhone).toBe('+44123456789');
  });

  it('should sign out and clear state', async () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setUser(mockUser));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
    expect(cookies.clearAuthTokens).toHaveBeenCalled();
  });

  it('should hydrateFromStorage: set authenticated when token exists', async () => {
    (cookies.getAccessToken as jest.Mock).mockReturnValue('token-abc');
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.hydrateFromStorage();
    });

    expect(result.current.status).toBe('authenticated');
  });

  it('should hydrateFromStorage: set unauthenticated when no token', async () => {
    (cookies.getAccessToken as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.hydrateFromStorage();
    });

    expect(result.current.status).toBe('unauthenticated');
  });

  it('should reset to initial state', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => result.current.setUser(mockUser));
    act(() => result.current.reset());
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('unknown');
  });
});
