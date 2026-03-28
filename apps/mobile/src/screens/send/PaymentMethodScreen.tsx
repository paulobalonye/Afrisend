import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';

type NavigationProp = NativeStackNavigationProp<SendStackParamList>;

type PaymentMethod = 'card' | 'bank_transfer';

const METHODS: { id: PaymentMethod; icon: string; labelKey: string }[] = [
  { id: 'card', icon: '💳', labelKey: 'send.step3.card' },
  { id: 'bank_transfer', icon: '🏦', labelKey: 'send.step3.bankTransfer' },
];

export function PaymentMethodScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  function handleNext() {
    navigation.navigate('SendReview');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Typography style={{ color: theme.colors.primary }}>← {t('common.back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h3" style={{ color: theme.colors.text, marginTop: 8 }}>
          {t('send.step3.title')}
        </Typography>
        <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
          {t('send.step3.subtitle')}
        </Typography>
      </View>

      <View style={styles.methods}>
        {METHODS.map((method) => {
          const isActive = selected === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              testID={`payment-method-${method.id}`}
              style={[
                styles.methodCard,
                {
                  backgroundColor: isActive
                    ? theme.colors.primary + '12'
                    : theme.colors.surface,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => setSelected(method.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              <Typography style={{ fontSize: 32 }}>{method.icon}</Typography>
              <Typography
                variant="body"
                style={{ color: theme.colors.text, fontWeight: isActive ? '700' : '400' }}
              >
                {t(method.labelKey)}
              </Typography>
              {isActive && (
                <Typography style={{ color: theme.colors.primary, marginLeft: 'auto' }}>
                  ✓
                </Typography>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button
          testID="next-button"
          label={t('common.next')}
          onPress={handleNext}
          disabled={!selected}
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
    gap: 4,
  },
  methods: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
});
