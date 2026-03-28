import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Typography } from '@/components/ui/Typography';

type KycProgressHeaderProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
  canGoBack?: boolean;
};

export function KycProgressHeader({
  currentStep,
  totalSteps,
  title,
  canGoBack = true,
}: KycProgressHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const progress = currentStep / totalSteps;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {canGoBack && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Typography variant="body" style={{ color: theme.colors.primary }}>
              ←
            </Typography>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Typography variant="label" style={{ color: theme.colors.textSecondary }}>
            Step {currentStep} of {totalSteps}
          </Typography>
          <Typography variant="h4" style={{ color: theme.colors.text }}>
            {title}
          </Typography>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.primary,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    paddingTop: 4,
    paddingRight: 4,
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
