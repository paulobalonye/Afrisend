import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';
import { AmountDisplay } from './AmountDisplay';
import { StatusIndicator, TransactionStatus } from './StatusIndicator';

export type Transaction = {
  id: string;
  recipientName: string;
  recipientCountry?: string;
  /** Amount sent in sender currency */
  sendAmount: number;
  sendCurrency: string;
  /** Amount received in recipient currency */
  receiveAmount?: number;
  receiveCurrency?: string;
  status: TransactionStatus;
  createdAt: string | Date;
  reference?: string;
};

type TransactionRowProps = {
  transaction: Transaction;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  NG: '🇳🇬',
  GH: '🇬🇭',
  KE: '🇰🇪',
  ZA: '🇿🇦',
  TZ: '🇹🇿',
  UG: '🇺🇬',
  SN: '🇸🇳',
  CI: '🇨🇮',
};

const DIRECTION_ICONS: Record<TransactionStatus, string> = {
  completed: '↗',
  pending: '↗',
  processing: '↗',
  failed: '✕',
  cancelled: '✕',
  refunded: '↙',
};

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TransactionRow({
  transaction,
  onPress,
  style,
  testID,
}: TransactionRowProps) {
  const theme = useTheme();

  const isFailed = transaction.status === 'failed' || transaction.status === 'cancelled';
  const isRefunded = transaction.status === 'refunded';
  const flag = transaction.recipientCountry
    ? (COUNTRY_FLAGS[transaction.recipientCountry] ?? '🌍')
    : null;
  const icon = DIRECTION_ICONS[transaction.status];

  const iconBg = isFailed
    ? theme.colors.error + '15'
    : isRefunded
    ? theme.colors.info + '15'
    : theme.colors.primary + '15';

  const iconColor = isFailed
    ? theme.colors.error
    : isRefunded
    ? theme.colors.info
    : theme.colors.primary;

  const content = (
    <View style={[styles.row, style]}>
      {/* Direction icon */}
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Typography style={{ color: iconColor, fontSize: 16, fontWeight: '700' }}>
          {icon}
        </Typography>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.topRow}>
          <View style={styles.recipientRow}>
            <Typography
              variant="body"
              style={{ color: theme.colors.text, fontWeight: '600' }}
              numberOfLines={1}
            >
              {transaction.recipientName}
            </Typography>
            {flag && <Typography style={styles.flag}>{flag}</Typography>}
          </View>
          <AmountDisplay
            amount={transaction.sendAmount}
            currency={transaction.sendCurrency}
            size="sm"
            color={isFailed ? theme.colors.error : theme.colors.text}
          />
        </View>

        <View style={styles.bottomRow}>
          <StatusIndicator status={transaction.status} size="sm" />
          <Typography variant="caption" style={{ color: theme.colors.textDisabled }}>
            {formatDate(transaction.createdAt)}
          </Typography>
        </View>

        {transaction.receiveAmount != null && transaction.receiveCurrency && (
          <Typography variant="caption" style={{ color: theme.colors.textSecondary, marginTop: 2 }}>
            Recipient gets{' '}
            <Typography
              variant="caption"
              style={{ color: theme.colors.success, fontWeight: '600' }}
            >
              {transaction.receiveCurrency}{' '}
              {new Intl.NumberFormat('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(transaction.receiveAmount)}
            </Typography>
          </Typography>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Transaction to ${transaction.recipientName}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View testID={testID}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  details: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  flag: {
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
