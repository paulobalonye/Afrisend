import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  testID?: string;
};

export function Input({
  label,
  error,
  hint,
  containerStyle,
  rightIcon,
  isPassword = false,
  testID,
  ...textInputProps
}: InputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : isFocused
      ? theme.colors.borderFocus
      : theme.colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Typography variant="label" style={[styles.label, { color: theme.colors.textSecondary }]}>
          {label}
        </Typography>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor,
            backgroundColor: theme.colors.inputBackground,
          },
          isFocused && styles.focused,
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          placeholderTextColor={theme.colors.textDisabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !isPasswordVisible}
          testID={testID}
          accessibilityLabel={label}
          {...textInputProps}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((v) => !v)}
            style={styles.iconButton}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Typography variant="caption" style={{ color: theme.colors.textSecondary }}>
              {isPasswordVisible ? 'Hide' : 'Show'}
            </Typography>
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <View style={styles.iconButton}>{rightIcon}</View>
        )}
      </View>
      {error && (
        <Typography
          variant="caption"
          style={[styles.hint, { color: theme.colors.error }]}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Typography>
      )}
      {hint && !error && (
        <Typography
          variant="caption"
          style={[styles.hint, { color: theme.colors.textSecondary }]}
        >
          {hint}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  focused: {
    shadowColor: '#1A6B3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  iconButton: {
    paddingLeft: 8,
  },
  hint: {
    marginTop: 4,
    marginLeft: 2,
  },
});
