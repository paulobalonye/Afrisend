import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useRemittanceStore } from '@/store/remittanceStore';
import { useQuoteCountdown } from '@/hooks/useQuoteCountdown';
import { listSupportedCorridors, getRates } from '@/api/endpoints/yellowcard';
import { getRecipient } from '@/api/endpoints/recipients';
import type { Corridor, RateQuote } from '@/api/endpoints/yellowcard';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';

type NavigationProp = NativeStackNavigationProp<SendStackParamList>;
type RouteType = RouteProp<SendStackParamList, 'SendAmount'>;

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function AmountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const theme = useTheme();

  const { recipientId } = route.params;

  const {
    setSourceAmount,
    setCurrentQuote,
    setSelectedCorridor,
    selectedCorridor,
    sourceAmount,
    currentQuote,
  } = useRemittanceStore();

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [localAmount, setLocalAmount] = useState(sourceAmount);

  const { formattedTime, isExpired } = useQuoteCountdown(
    currentQuote?.expiresAt ?? null,
  );

  // Load corridors + recipient on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([listSupportedCorridors(), getRecipient(recipientId)]).then(
      ([cors, recipient]) => {
        if (cancelled) return;
        setCorridors(cors);
        // Auto-select corridor matching recipient country
        const match = cors.find((c) => c.destinationCountry === recipient.country);
        if (match) setSelectedCorridor(match);
      },
    );
    return () => { cancelled = true; };
  }, [recipientId, setSelectedCorridor]);

  // Fetch quote when amount or corridor changes
  const fetchQuote = useCallback(async () => {
    const amount = parseFloat(localAmount);
    if (!selectedCorridor || !localAmount || isNaN(amount) || amount <= 0) {
      setCurrentQuote(null);
      return;
    }

    if (amount < selectedCorridor.minAmount) {
      setAmountError(t('send.step2.minAmount', { amount: selectedCorridor.minAmount }));
      setCurrentQuote(null);
      return;
    }
    if (amount > selectedCorridor.maxAmount) {
      setAmountError(t('send.step2.maxAmount', { amount: selectedCorridor.maxAmount }));
      setCurrentQuote(null);
      return;
    }
    setAmountError(null);

    setIsLoadingQuote(true);
    setQuoteError(null);
    try {
      const quote = await getRates({
        corridorId: selectedCorridor.id,
        sourceAmount: amount,
        refreshIntervalSeconds: selectedCorridor.refreshIntervalSeconds,
      });
      setCurrentQuote(quote);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Failed to get rate');
      setCurrentQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [localAmount, selectedCorridor, setCurrentQuote, t]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Auto-refresh when quote expires
  useEffect(() => {
    if (isExpired && currentQuote) {
      fetchQuote();
    }
  }, [isExpired, currentQuote, fetchQuote]);

  function handleAmountChange(text: string) {
    const sanitised = text.replace(/[^0-9.]/g, '');
    setLocalAmount(sanitised);
    setSourceAmount(sanitised);
  }

  function handleNext() {
    navigation.navigate('SendPaymentMethod');
  }

  const isReady = !!currentQuote && !isLoadingQuote && !amountError;

  return (
    <Screen scrollable avoidKeyboard>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Typography style={{ color: theme.colors.primary }}>← {t('common.back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h3" style={{ color: theme.colors.text, marginTop: 8 }}>
          {t('send.step2.title')}
        </Typography>
      </View>

      <View style={styles.content}>
        {/* Source amount input */}
        <View style={[styles.amountCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
            {t('send.step2.sendLabel')}
          </Typography>
          <View style={styles.amountRow}>
            <Typography variant="h3" style={{ color: theme.colors.textSecondary, marginRight: 8 }}>
              GBP
            </Typography>
            <TextInput
              testID="amount-input"
              value={localAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textDisabled}
              style={[styles.amountInput, { color: theme.colors.text }]}
            />
          </View>
          {amountError && (
            <Typography variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
              {amountError}
            </Typography>
          )}
        </View>

        {/* Quote breakdown */}
        {isLoadingQuote && (
          <View style={styles.quoteLoading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginLeft: 8 }}>
              {t('send.step2.quoteRefreshing')}
            </Typography>
          </View>
        )}

        {currentQuote && !isLoadingQuote && (
          <View
            style={[styles.quoteCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View style={styles.quoteRow}>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                {t('send.step2.receiveLabel')}
              </Typography>
              <Typography variant="h4" style={{ color: theme.colors.primary }}>
                {formatNumber(currentQuote.destinationAmount)}{' '}
                {currentQuote.destinationCurrency}
              </Typography>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.quoteRow}>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                {t('send.step2.rate')}
              </Typography>
              <Typography variant="bodySmall" style={{ color: theme.colors.text }}>
                1 GBP = {formatNumber(currentQuote.exchangeRate)}{' '}
                {currentQuote.destinationCurrency}
              </Typography>
            </View>
            <View style={styles.quoteRow}>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                {t('send.step2.fee')}
              </Typography>
              <Typography variant="bodySmall" style={{ color: theme.colors.text }}>
                {currentQuote.fee.toFixed(2)} GBP
              </Typography>
            </View>
            {/* Countdown */}
            <View
              testID="quote-countdown"
              style={[styles.countdown, { backgroundColor: theme.colors.primary + '15' }]}
            >
              <Typography variant="caption" style={{ color: theme.colors.primary }}>
                {t('send.step2.rateLockedFor', { time: formattedTime })}
              </Typography>
            </View>
          </View>
        )}

        {quoteError && (
          <Typography variant="bodySmall" style={{ color: theme.colors.error, textAlign: 'center' }}>
            {quoteError}
          </Typography>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          testID="next-button"
          label={t('common.next')}
          onPress={handleNext}
          disabled={!isReady}
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  amountCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
  },
  quoteLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  quoteCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
  },
  countdown: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
});
