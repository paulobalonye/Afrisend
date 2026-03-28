import { renderHook } from '@testing-library/react-hooks';

// jest.mock factories are hoisted above const/let, so all mock fns must be
// created inside the factory (self-contained).  We retrieve them via
// require() after jest.mock has run.

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/api/client', () => ({ post: jest.fn() }));

import { usePushNotifications } from '@/hooks/usePushNotifications';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as ApiClient from '@/api/client';

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockSetNotificationHandler = Notifications.setNotificationHandler as jest.Mock;
const mockSaveAsync = SecureStore.setItemAsync as jest.Mock;
const mockPost = (ApiClient as { post: jest.Mock }).post;

const FCM_TOKEN_KEY = 'afrisend_fcm_token';

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token-123]' });
    mockPost.mockResolvedValue({ registered: true });
  });

  it('registers FCM token when permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const { result, waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(result.current.pushToken).toBe('ExponentPushToken[test-token-123]');
  });

  it('requests permission if not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const { waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('saves FCM token to secure store', async () => {
    const { waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(mockSaveAsync).toHaveBeenCalledWith(FCM_TOKEN_KEY, 'ExponentPushToken[test-token-123]');
  });

  it('posts FCM token to backend /users/me/push-token', async () => {
    const { waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(mockPost).toHaveBeenCalledWith('/users/me/push-token', {
      token: 'ExponentPushToken[test-token-123]',
      platform: expect.any(String),
    });
  });

  it('sets permissionGranted=false and no token when user denies permission', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { result, waitFor } = renderHook(() => usePushNotifications());
    // Wait for the async effect to complete - no token should ever be set
    await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalled());
    expect(result.current.permissionGranted).toBe(false);
    expect(result.current.pushToken).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('does not crash when token registration fails', async () => {
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Network error'));
    const { result, waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(result.current.pushToken).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('sets notification handler on mount', async () => {
    const { waitForNextUpdate } = renderHook(() => usePushNotifications());
    await waitForNextUpdate();
    expect(mockSetNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    );
  });
});
