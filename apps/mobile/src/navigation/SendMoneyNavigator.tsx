import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SelectRecipientScreen } from '@/screens/send/SelectRecipientScreen';
import { AmountScreen } from '@/screens/send/AmountScreen';
import { PaymentMethodScreen } from '@/screens/send/PaymentMethodScreen';
import { ReviewConfirmScreen } from '@/screens/send/ReviewConfirmScreen';
import { ProcessingReceiptScreen } from '@/screens/send/ProcessingReceiptScreen';
import { TransactionHistoryScreen } from '@/screens/send/TransactionHistoryScreen';

export type SendStackParamList = {
  SelectRecipient: undefined;
  AddRecipient: undefined;
  SendAmount: { recipientId: string };
  SendPaymentMethod: undefined;
  SendReview: undefined;
  SendProcessing: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
};

const Stack = createNativeStackNavigator<SendStackParamList>();

export function SendMoneyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SelectRecipient" component={SelectRecipientScreen} />
      <Stack.Screen name="SendAmount" component={AmountScreen} />
      <Stack.Screen name="SendPaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="SendReview" component={ReviewConfirmScreen} />
      <Stack.Screen name="SendProcessing" component={ProcessingReceiptScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
