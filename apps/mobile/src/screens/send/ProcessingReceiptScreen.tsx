import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useRemittanceStore } from '@/store/remittanceStore';
import { getPaymentStatus } from '@/api/endpoints/yellowcard';
import type { PaymentStatus } from '@/api/endpoints/yellowcard';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';
import type { RootStackParamList } from '@/navigation/index';

type NavigationProp = NativeStackNavigationProp<SendStackParamList & RootStackParamList>;

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 10;

export function ProcessingReceiptScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const { currentPayment, updatePaymentStatus, resetFlow } = useRemittanceStore();

  const [status, setStatus] = useState<PaymentStatus>(
    currentPayment?.status ?? 'pending',
  );
  const [pollCount, setPollCount] = useState(0);
  const [failureReason, setFailureReason] = useState<string | undefined>(
    currentPayment?.failureReason,
  );

  useEffect(() => {
    if (!currentPayment?.id) return;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') return;
    if (pollCount >= MAX_POLLS) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await getPaymentStatus(currentPayment.id);
        setStatus(updated.status);
        updatePaymentStatus(currentPayment.id, updated.status);
        if (updated.failureReason) setFailureReason(updated.failureReason);
      } catch {
        // keep polling silently on error
      } finally {
        setPollCount((c) => c + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [status, pollCount, currentPayment, updatePaymentStatus]);

  async function handleShare() {
    if (!currentPayment) return;
    await Share.share({
      message: `Transfer sent! ID: ${currentPayment.id}\n${currentPayment.sourceAmount} ${currentPayment.sourceCurrency} → ${currentPayment.destinationAmount} ${currentPayment.destinationCurrency}`,
    });
  }

  function handleSendAnother() {
    resetFlow();
    navigation.navigate('SelectRecipient');
  }

  function handleGoHome() {
    resetFlow();
    navigation.navigate('Main');
  }

  function handleRetry() {
    navigation.navigate('SendReview');
  }

  if (status === 'pending' || status === 'processing') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Typography variant="h4" style={{ color: theme.colors.text, marginTop: 24 }}>
            {t('send.step5.processingTitle')}
          </Typography>
          <Typography
            variant="bodySmall"
            style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}
          >
            {t('send.step5.processingSubtitle')}
          </Typography>
          {currentPayment?.id && (
            <Typography
              variant="caption"
              style={{ color: theme.colors.textSecondary, marginTop: 16 }}
            >
              {t('send.step5.transactionId')}: {currentPayment.id}
            </Typography>
          )}
        </View>
      </Screen>
    );
  }

  if (status === 'completed') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Typography style={{ fontSize: 72 }}>🎉</Typography>
          <Typography variant="h3" style={{ color: theme.colors.success, marginTop: 16 }}>
            {t('send.step5.successTitle')}
          </Typography>
          <Typography
            variant="bodySmall"
            style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}
          >
            {t('send.step5.successSubtitle')}
          </Typography>
          {currentPayment?.id && (
            <View
              style={[
                styles.receiptBox,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Typography variant="caption" style={{ color: theme.colors.textSecondary }}>
                {t('send.step5.transactionId')}
              </Typography>
              <Typography
                variant="bodySmall"
                style={{ color: theme.colors.text, fontWeight: '600' }}
              >
                {currentPayment.id}
              </Typography>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <Button
            label={t('send.step5.shareReceipt')}
            onPress={handleShare}
            variant="outline"
            fullWidth
          />
          <Button
            label={t('send.step5.sendAnother')}
            onPress={handleSendAnother}
            variant="outline"
            fullWidth
          />
          <Button label={t('send.step5.backHome')} onPress={handleGoHome} fullWidth />
        </View>
      </Screen>
    );
  }

  // failed or cancelled
  return (
    <Screen>
      <View style={styles.centered}>
        <Typography style={{ fontSize: 72 }}>❌</Typography>
        <Typography variant="h3" style={{ color: theme.colors.error, marginTop: 16 }}>
          {t('send.step5.failureTitle')}
        </Typography>
        <Typography
          variant="bodySmall"
          style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}
        >
          {t('send.step5.failureSubtitle')}
        </Typography>
        {failureReason && (
          <Typography
            variant="bodySmall"
            style={{ color: theme.colors.error, marginTop: 8 }}
          >
            {t('send.step5.failureReason', { reason: failureReason })}
          </Typography>
        )}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('send.step5.retryButton')}
          onPress={handleRetry}
          fullWidth
        />
        <Button
          label={t('send.step5.backHome')}
          onPress={handleGoHome}
          variant="outline"
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  receiptBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
});
