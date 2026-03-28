import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  testID?: string;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  style,
  testID,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const resolvedRadius = borderRadius ?? theme.borderRadius.sm;

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          width,
          height,
          borderRadius: resolvedRadius,
          backgroundColor: theme.colors.surfaceSecondary,
          opacity,
        },
        style,
      ]}
    />
  );
}

// --- Compound skeleton layouts for common list items ---

type TransactionRowSkeletonProps = { style?: ViewStyle };

export function TransactionRowSkeleton({ style }: TransactionRowSkeletonProps) {
  return (
    <View style={[styles.txRow, style]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.txDetails}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={64} height={14} />
    </View>
  );
}

type RecipientRowSkeletonProps = { style?: ViewStyle };

export function RecipientRowSkeleton({ style }: RecipientRowSkeletonProps) {
  return (
    <View style={[styles.txRow, style]}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={styles.txDetails}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="35%" height={11} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

type ListSkeletonProps = {
  count?: number;
  type?: 'transaction' | 'recipient';
  style?: ViewStyle;
};

export function ListSkeleton({ count = 5, type = 'transaction', style }: ListSkeletonProps) {
  const RowComponent = type === 'recipient' ? RecipientRowSkeleton : TransactionRowSkeleton;
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <RowComponent key={i} style={i > 0 ? styles.listItemSpacing : undefined} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  txDetails: {
    flex: 1,
  },
  listItemSpacing: {
    marginTop: 4,
  },
});
