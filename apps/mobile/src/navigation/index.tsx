import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import { OnboardingNavigator } from './OnboardingNavigator';
import { KycNavigator } from './KycNavigator';
import { MainNavigator } from './MainNavigator';

export type RootStackParamList = {
  Onboarding: undefined;
  Kyc: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status, hydrateFromStorage } = useAuthStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (status === 'unknown') {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'unauthenticated' || status === 'authenticating' || status === 'profile_incomplete' ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Kyc" component={KycNavigator} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
