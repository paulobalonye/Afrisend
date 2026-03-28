import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type StepIndicatorProps = {
  totalSteps: number;
  currentStep: number;
  style?: ViewStyle;
};

export function StepIndicator({ totalSteps, currentStep, style }: StepIndicatorProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]} accessible accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: totalSteps - 1, now: currentStep }}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === currentStep
                  ? theme.colors.primary
                  : index < currentStep
                    ? theme.colors.primary
                    : theme.colors.border,
              width: index === currentStep ? 24 : 8,
              opacity: index < currentStep ? 0.5 : 1,
            },
          ]}
        />
      ))}
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
    height: 8,
    borderRadius: 4,
  },
});
