import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useRemittanceStore } from '@/store/remittanceStore';
import { initiatePayment } from '@/api/endpoints/yellowcard';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';

type NavigationProp = NativeStackNavigationProp<SendStackParamList>;

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

type SummaryRowProps = { label: string; value: string; highlight?: boolean };
function SummaryRow({ label, value, highlight }: SummaryRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
        {label}
      </Typography>
      <Typography
        variant="body"
        style={{ color: highlight ? theme.colors.primary : theme.colors.text, fontWeight: highlight ? '700' : '400' }}
      >
        {value}
      </Typography>
    </View>
  );
}

export function ReviewConfirmScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const { currentQuote, recipient, setCurrentPayment, addPaymentToHistory } =
    useRemittanceStore();

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!termsAgreed || !currentQuote || !recipient) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payment = await initiatePayment({
        idempotencyKey: crypto.randomUUID(),
        quoteId: currentQuote.quoteId,
        corridorId: currentQuote.corridorId,
        sourceCurrency: 'USDC',
        sourceAmount: currentQuote.sourceAmount,
        recipient,
      });
      setCurrentPayment(payment);
      addPaymentToHistory(payment);
      navigation.navigate('SendProcessing');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!currentQuote || !recipient) {
    return (
      <Screen>
        <View style={styles.centeredMessage}>
          <Typography style={{ color: theme.colors.error }}>
            Missing quote or recipient. Please start over.
          </Typography>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Typography style={{ color: theme.colors.primary }}>← {t('common.back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h3" style={{ color: theme.colors.text, marginTop: 8 }}>
          {t('send.step4.title')}
        </Typography>
        <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
          {t('send.step4.subtitle')}
        </Typography>
      </View>

      <View style={styles.content}>
        <View
          style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <SummaryRow
            label={t('send.step4.youSend')}
            value={`${currentQuote.sourceAmount.toFixed(2)} ${currentQuote.sourceCurrency}`}
            highlight
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <SummaryRow
            label={t('send.step4.theyReceive')}
            value={`${formatNumber(currentQuote.destinationAmount)} ${currentQuote.destinationCurrency}`}
            highlight
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <SummaryRow
            label={t('send.step4.exchangeRate')}
            value={`1 ${currentQuote.sourceCurrency} = ${formatNumber(currentQuote.exchangeRate)} ${currentQuote.destinationCurrency}`}
          />
          <SummaryRow
            label={t('send.step4.fees')}
            value={`${currentQuote.fee.toFixed(2)} ${currentQuote.sourceCurrency}`}
          />
          <SummaryRow
            label={t('send.step4.recipient')}
            value={recipient.name}
          />
          <SummaryRow
            label={t('send.step4.estimatedArrival')}
            value={t('send.step4.arrivalTime')}
          />
        </View>

        {/* Terms checkbox */}
        <TouchableOpacity
          testID="terms-checkbox"
          style={styles.termsRow}
          onPress={() => setTermsAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAgreed }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: termsAgreed ? theme.colors.primary : theme.colors.border,
                backgroundColor: termsAgreed ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            {termsAgreed && (
              <Typography style={{ color: '#FFF', fontSize: 12, lineHeight: 16 }}>✓</Typography>
            )}
          </View>
          <Typography
            variant="bodySmall"
            style={{ color: theme.colors.textSecondary, flex: 1, marginLeft: 10 }}
          >
            {t('send.step4.termsAgreement')}
          </Typography>
        </TouchableOpacity>

        {submitError && (
          <Typography
            variant="bodySmall"
            style={{ color: theme.colors.error, textAlign: 'center' }}
          >
            {submitError}
          </Typography>
        )}
      </View>

      <View style={styles.footer}>
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.primary} size="large" />
        ) : (
          <Button
            testID="confirm-button"
            label={t('send.step4.confirmButton')}
            onPress={handleConfirm}
            disabled={!termsAgreed}
            fullWidth
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
});
