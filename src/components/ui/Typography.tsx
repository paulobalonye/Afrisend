import React, { ReactNode } from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'button'
  | 'label'
  | 'link';

type TypographyProps = {
  variant?: TypographyVariant;
  children: ReactNode;
  style?: TextStyle;
  color?: string;
  center?: boolean;
  numberOfLines?: number;
  testID?: string;
};

export function Typography({
  variant = 'body',
  children,
  style,
  color,
  center = false,
  numberOfLines,
  testID,
}: TypographyProps) {
  const theme = useTheme();

  const baseStyle: TextStyle = {
    color: color ?? theme.colors.text,
    textAlign: center ? 'center' : 'left',
  };

  return (
    <Text
      style={[baseStyle, variantStyles[variant], style]}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const variantStyles: Record<TypographyVariant, TextStyle> = StyleSheet.create({
  h1: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  link: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
});
