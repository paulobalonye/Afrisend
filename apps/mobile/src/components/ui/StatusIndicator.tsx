import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type KycStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected';

type StatusVariant = TransactionStatus | KycStatus;

type StatusIndicatorProps = {
  status: StatusVariant;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  testID?: string;
};

type StatusConfig = {
  label: string;
  dotColor: string;
  textColor: string;
};

const TRANSACTION_STATUS_CONFIG: Record<TransactionStatus, Omit<StatusConfig, 'dotColor' | 'textColor'> & { colorKey: 'success' | 'warning' | 'error' | 'info' | 'textSecondary' }> = {
  pending: { label: 'Pending', colorKey: 'warning' },
  processing: { label: 'Processing', colorKey: 'info' },
  completed: { label: 'Completed', colorKey: 'success' },
  failed: { label: 'Failed', colorKey: 'error' },
  cancelled: { label: 'Cancelled', colorKey: 'textSecondary' },
  refunded: { label: 'Refunded', colorKey: 'info' },
};

const KYC_STATUS_CONFIG: Record<KycStatus, Omit<StatusConfig, 'dotColor' | 'textColor'> & { colorKey: 'success' | 'warning' | 'error' | 'info' | 'textSecondary' }> = {
  not_started: { label: 'Not Started', colorKey: 'textSecondary' },
  in_progress: { label: 'In Progress', colorKey: 'info' },
  pending_review: { label: 'Under Review', colorKey: 'warning' },
  approved: { label: 'Verified', colorKey: 'success' },
  rejected: { label: 'Rejected', colorKey: 'error' },
};

const ALL_STATUS_CONFIG = { ...TRANSACTION_STATUS_CONFIG, ...KYC_STATUS_CONFIG };

export function StatusIndicator({
  status,
  showLabel = true,
  size = 'md',
  style,
  testID,
}: StatusIndicatorProps) {
  const theme = useTheme();

  const config = ALL_STATUS_CONFIG[status as keyof typeof ALL_STATUS_CONFIG];
  if (!config) return null;

  const color = theme.colors[config.colorKey];
  const dotSize = size === 'sm' ? 6 : 8;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View
        style={[
          styles.dot,
          { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
        ]}
      />
      {showLabel && (
        <Typography
          variant={size === 'sm' ? 'caption' : 'bodySmall'}
          style={{ color, fontWeight: '600' }}
        >
          {config.label}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    flexShrink: 0,
  },
});
