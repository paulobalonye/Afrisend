import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  labelStyle,
  testID,
}: ButtonProps) {
  const theme = useTheme();

  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    getSizeStyle(size),
    getVariantStyle(variant, theme.colors),
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFF' : theme.colors.primary}
          size="small"
        />
      ) : (
        <Typography
          variant="button"
          style={[getLabelStyle(variant, theme.colors), labelStyle]}
        >
          {label}
        </Typography>
      )}
    </TouchableOpacity>
  );
}

function getSizeStyle(size: ButtonSize): ViewStyle {
  switch (size) {
    case 'sm':
      return { paddingVertical: 10, paddingHorizontal: 16 };
    case 'lg':
      return { paddingVertical: 18, paddingHorizontal: 24 };
    default:
      return { paddingVertical: 14, paddingHorizontal: 20 };
  }
}

function getVariantStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary };
    case 'secondary':
      return { backgroundColor: colors.surfaceSecondary };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary,
      };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'danger':
      return { backgroundColor: colors.error };
    default:
      return { backgroundColor: colors.primary };
  }
}

function getLabelStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): TextStyle {
  switch (variant) {
    case 'primary':
    case 'danger':
      return { color: '#FFF' };
    case 'secondary':
      return { color: colors.text };
    case 'outline':
    case 'ghost':
      return { color: colors.primary };
    default:
      return { color: '#FFF' };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});
