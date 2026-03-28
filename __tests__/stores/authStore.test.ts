import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '../../src/store/authStore';

// Mock storage
jest.mock('../../src/utils/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthTokens: jest.fn().mockResolvedValue(undefined),
  appStorage: {
    clearAll: jest.fn(),
  },
}));

const mockUser = {
  id: 'user-1',
  phone: '+1555000000',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  kycTier: 0 as const,
  kycStatus: 'none' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'unknown',
      user: null,
      sessionId: null,
      temporaryToken: null,
      pendingPhone: null,
    });
  });

  it('starts with unknown status', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.status).toBe('unknown');
    expect(result.current.user).toBeNull();
  });

  it('sets user and updates status to authenticated', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(mockUser);
    });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.status).toBe('authenticated');
  });

  it('sets session id', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setSessionId('session-abc');
    });
    expect(result.current.sessionId).toBe('session-abc');
  });

  it('sets temporary token', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setTemporaryToken('temp-token-xyz');
    });
    expect(result.current.temporaryToken).toBe('temp-token-xyz');
  });

  it('sets pending phone', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setPendingPhone('+1555987654');
    });
    expect(result.current.pendingPhone).toBe('+1555987654');
  });

  it('resets to initial state on signOut', async () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setUser(mockUser);
      result.current.setSessionId('session-1');
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
  });

  it('hydrates to unauthenticated when no token exists', async () => {
    const { result } = renderHook(() => useAuthStore());
    await act(async () => {
      await result.current.hydrateFromStorage();
    });
    expect(result.current.status).toBe('unauthenticated');
  });

  it('hydrates to authenticated when token exists', async () => {
    const { getAccessToken } = require('../../src/utils/storage');
    (getAccessToken as jest.Mock).mockResolvedValueOnce('valid-token');

    const { result } = renderHook(() => useAuthStore());
    await act(async () => {
      await result.current.hydrateFromStorage();
    });
    expect(result.current.status).toBe('authenticated');
  });

  it('resets all state on reset()', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(mockUser);
      result.current.setSessionId('session-1');
      result.current.reset();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.status).toBe('unknown');
  });
});
