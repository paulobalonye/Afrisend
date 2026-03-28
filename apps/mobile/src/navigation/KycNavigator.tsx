import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { KycIntroScreen } from '@/screens/kyc/KycIntroScreen';
import { IdUploadScreen } from '@/screens/kyc/IdUploadScreen';
import { SelfieScreen } from '@/screens/kyc/SelfieScreen';
import { AddressScreen } from '@/screens/kyc/AddressScreen';
import { KycStatusScreen } from '@/screens/kyc/KycStatusScreen';

export type KycStackParamList = {
  KycIntro: undefined;
  IdUpload: undefined;
  Selfie: undefined;
  Address: undefined;
  KycStatus: undefined;
};

const Stack = createNativeStackNavigator<KycStackParamList>();

export function KycNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="KycIntro" component={KycIntroScreen} />
      <Stack.Screen name="IdUpload" component={IdUploadScreen} />
      <Stack.Screen name="Selfie" component={SelfieScreen} />
      <Stack.Screen name="Address" component={AddressScreen} />
      <Stack.Screen name="KycStatus" component={KycStatusScreen} />
    </Stack.Navigator>
  );
}
