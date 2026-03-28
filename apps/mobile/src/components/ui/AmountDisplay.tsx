import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

type AmountSize = 'sm' | 'md' | 'lg' | 'xl';

type AmountDisplayProps = {
  amount: number;
  currency: string;
  /** ISO 4217 locale string, defaults to 'en-NG' */
  locale?: string;
  size?: AmountSize;
  /** Show currency symbol inline */
  showSymbol?: boolean;
  /** Show currency code as suffix label */
  showCode?: boolean;
  color?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
};

const SIZE_VARIANT: Record<AmountSize, 'bodySmall' | 'body' | 'h3' | 'h2'> = {
  sm: 'bodySmall',
  md: 'body',
  lg: 'h3',
  xl: 'h2',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

export function formatCurrencyAmount(
  amount: number,
  currency: string,
  locale = 'en-NG',
): { symbol: string; formatted: string; code: string } {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return { symbol, formatted, code: currency };
}

export function AmountDisplay({
  amount,
  currency,
  locale = 'en-NG',
  size = 'md',
  showSymbol = true,
  showCode = false,
  color,
  style,
  textStyle,
  testID,
}: AmountDisplayProps) {
  const theme = useTheme();
  const { symbol, formatted, code } = formatCurrencyAmount(amount, currency, locale);
  const isNegative = amount < 0;
  const resolvedColor = color ?? (isNegative ? theme.colors.error : theme.colors.text);
  const variant = SIZE_VARIANT[size];

  return (
    <View style={[styles.container, style]} testID={testID}>
      {showSymbol && (
        <Typography
          variant={size === 'xl' ? 'h3' : variant}
          style={[styles.symbol, { color: resolvedColor }, textStyle]}
        >
          {isNegative ? '-' : ''}{symbol}
        </Typography>
      )}
      <Typography variant={variant} style={[{ color: resolvedColor }, textStyle]}>
        {formatted}
      </Typography>
      {showCode && (
        <Typography
          variant="caption"
          style={[styles.code, { color: theme.colors.textSecondary }]}
        >
          {code}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  symbol: {
    fontWeight: '600',
  },
  code: {
    marginLeft: 4,
    alignSelf: 'center',
  },
});
