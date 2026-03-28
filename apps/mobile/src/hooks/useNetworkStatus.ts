import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

export type NetworkStatus = {
  isOnline: boolean;
  isChecking: boolean;
  recheck: () => Promise<void>;
};

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkNetwork = useCallback(async () => {
    setIsChecking(true);
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable));
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkNetwork();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkNetwork();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkNetwork]);

  return { isOnline, isChecking, recheck: checkNetwork };
}
