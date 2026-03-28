import React, { ReactNode } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
};

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  contentStyle,
  testID,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    ...(variant === 'outlined' && {
      borderWidth: 1,
      borderColor: theme.colors.border,
    }),
    ...(variant === 'elevated' && theme.shadows.md),
    ...(variant === 'default' && {
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.sm,
    }),
  };

  const inner = (
    <View style={[cardStyle, styles.inner, contentStyle, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: 16,
    overflow: 'hidden',
  },
});
