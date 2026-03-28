import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  testID?: string;
};

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  style,
  testID,
}: BadgeProps) {
  const theme = useTheme();

  const colors = getBadgeColors(variant, theme.colors);

  const containerStyle: ViewStyle = {
    backgroundColor: colors.background,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
    ...getSizeStyle(size),
  };

  const textStyle: TextStyle = {
    color: colors.text,
  };

  return (
    <View style={[containerStyle, style]} testID={testID}>
      <Typography
        variant={size === 'sm' ? 'caption' : 'label'}
        style={[styles.text, textStyle]}
      >
        {label}
      </Typography>
    </View>
  );
}

function getSizeStyle(size: BadgeSize): ViewStyle {
  switch (size) {
    case 'sm':
      return { paddingHorizontal: 6, paddingVertical: 2 };
    default:
      return { paddingHorizontal: 10, paddingVertical: 4 };
  }
}

type BadgeColors = { background: string; text: string };

function getBadgeColors(
  variant: BadgeVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): BadgeColors {
  switch (variant) {
    case 'primary':
      return { background: colors.primary + '20', text: colors.primary };
    case 'success':
      return { background: colors.success + '20', text: colors.success };
    case 'warning':
      return { background: colors.warning + '20', text: colors.warning };
    case 'error':
      return { background: colors.error + '20', text: colors.error };
    case 'info':
      return { background: colors.info + '20', text: colors.info };
    default:
      return { background: colors.surfaceSecondary, text: colors.textSecondary };
  }
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
