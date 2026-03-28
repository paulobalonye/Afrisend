import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { SettingsScreen } from '@/screens/main/SettingsScreen';
import { SendMoneyNavigator } from './SendMoneyNavigator';
import { TransactionHistoryScreen } from '@/screens/send/TransactionHistoryScreen';
import type { SendStackParamList } from './SendMoneyNavigator';

export type MainStackParamList = {
  Home: undefined;
  Settings: undefined;
  SendMoney: undefined;
  TransactionHistory: undefined;
} & SendStackParamList;

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SendMoney" component={SendMoneyNavigator} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
