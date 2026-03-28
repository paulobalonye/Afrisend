import { renderHook, act } from '@testing-library/react-hooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// Mock expo-network
const mockGetNetworkStateAsync = jest.fn();
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => mockGetNetworkStateAsync(),
  NetworkStateType: {
    NONE: 'NONE',
    WIFI: 'WIFI',
    CELLULAR: 'CELLULAR',
    UNKNOWN: 'UNKNOWN',
  },
}));

// Mock AppState
const mockAddEventListener = jest.fn();
const mockRemove = jest.fn();
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  currentState: 'active',
  addEventListener: (event: string, handler: (state: string) => void) => {
    mockAddEventListener(event, handler);
    return { remove: mockRemove };
  },
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  });

  it('returns isOnline=true when connected', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.isOnline).toBe(true);
  });

  it('returns isOnline=false when not connected', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.isOnline).toBe(false);
  });

  it('returns isOnline=false when isInternetReachable is false even if connected', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.isOnline).toBe(false);
  });

  it('starts with isChecking=true until first check completes', async () => {
    let resolveNetwork: (val: unknown) => void;
    mockGetNetworkStateAsync.mockReturnValue(
      new Promise((resolve) => { resolveNetwork = resolve; }),
    );
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    expect(result.current.isChecking).toBe(true);

    act(() => { resolveNetwork!({ isConnected: true, isInternetReachable: true }); });
    await waitForNextUpdate();

    expect(result.current.isChecking).toBe(false);
  });

  it('exposes a recheck function that updates status', async () => {
    mockGetNetworkStateAsync.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());
    await waitForNextUpdate();
    expect(result.current.isOnline).toBe(false);

    mockGetNetworkStateAsync.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    await act(async () => { await result.current.recheck(); });

    expect(result.current.isOnline).toBe(true);
  });

  it('registers AppState listener for active/background transitions', async () => {
    const { waitForNextUpdate } = renderHook(() => useNetworkStatus());
    await waitForNextUpdate();
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes AppState listener on unmount', async () => {
    const { unmount, waitForNextUpdate } = renderHook(() => useNetworkStatus());
    await waitForNextUpdate();
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
