import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '@/screens/onboarding/WelcomeScreen';
import { PhoneScreen } from '@/screens/onboarding/PhoneScreen';
import { OtpScreen } from '@/screens/onboarding/OtpScreen';
import { RegisterScreen } from '@/screens/onboarding/RegisterScreen';
import { ProfileSetupScreen } from '@/screens/onboarding/ProfileSetupScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Phone: undefined;
  Otp: { phone: string; sessionId: string };
  Register: { phone: string; temporaryToken: string };
  ProfileSetup: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}
