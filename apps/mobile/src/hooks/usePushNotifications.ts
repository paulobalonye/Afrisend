import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { post } from '@/api/client';

const FCM_TOKEN_KEY = 'afrisend_fcm_token';

export type PushNotificationState = {
  pushToken: string | null;
  permissionGranted: boolean;
  error: string | null;
};

export function usePushNotifications(): PushNotificationState {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    let cancelled = false;

    async function registerForPushNotifications() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          setPermissionGranted(false);
          return;
        }

        setPermissionGranted(true);

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        const token = tokenData.data;

        if (cancelled) return;

        await SecureStore.setItemAsync(FCM_TOKEN_KEY, token);

        await post('/users/me/push-token', {
          token,
          platform: Platform.OS,
        });

        setPushToken(token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to register push token');
        }
      }
    }

    registerForPushNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  return { pushToken, permissionGranted, error };
}
