import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';
import { setupProfile } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';
import { appStorage } from '@/utils/storage';
import { profileSetupSchema, ProfileSetupFormData } from '@/utils/validation';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'ProfileSetup'>;

const PURPOSES = ['family', 'business', 'savings', 'education', 'other'] as const;

export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { setUser, setStatus } = useAuthStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileSetupFormData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      dateOfBirth: '',
      nationality: '',
      residenceCountry: '',
      purpose: 'family',
    },
  });

  const selectedPurpose = watch('purpose');

  async function onSubmit(data: ProfileSetupFormData) {
    const user = await setupProfile(data);
    setUser(user);
    appStorage.setOnboardingComplete();
    setStatus('authenticated');
  }

  return (
    <Screen avoidKeyboard scrollable>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Typography variant="body" style={{ color: theme.colors.primary }}>
              ←
            </Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface }]}>
            <Typography style={styles.icon}>👤</Typography>
          </View>

          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 20 }}>
            {t('onboarding.profileSetup.title')}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 8, marginBottom: 28 }}
          >
            {t('onboarding.profileSetup.subtitle')}
          </Typography>

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.profileSetup.dateOfBirth')}
                value={value}
                onChangeText={onChange}
                placeholder="YYYY-MM-DD"
                keyboardType="numeric"
                error={errors.dateOfBirth ? t(errors.dateOfBirth.message ?? 'validation.required') : undefined}
                testID="dob-input"
              />
            )}
          />

          <Controller
            control={control}
            name="nationality"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.profileSetup.nationality')}
                value={value}
                onChangeText={onChange}
                autoCapitalize="words"
                placeholder="e.g. Nigerian, French, Brazilian"
                error={errors.nationality ? t(errors.nationality.message ?? 'validation.required') : undefined}
                testID="nationality-input"
              />
            )}
          />

          <Controller
            control={control}
            name="residenceCountry"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.profileSetup.residenceCountry')}
                value={value}
                onChangeText={onChange}
                autoCapitalize="words"
                placeholder="e.g. United States, France"
                error={errors.residenceCountry ? t(errors.residenceCountry.message ?? 'validation.required') : undefined}
                testID="residence-country-input"
              />
            )}
          />

          {/* Purpose picker */}
          <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('onboarding.profileSetup.purpose')}
          </Typography>
          <View style={styles.purposeGrid}>
            {PURPOSES.map((purpose) => {
              const isSelected = selectedPurpose === purpose;
              return (
                <TouchableOpacity
                  key={purpose}
                  onPress={() => setValue('purpose', purpose)}
                  style={[
                    styles.purposeChip,
                    {
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  testID={`purpose-${purpose}`}
                >
                  <Typography
                    variant="bodySmall"
                    style={{
                      color: isSelected ? theme.colors.primary : theme.colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    }}
                  >
                    {t(`onboarding.profileSetup.purposes.${purpose}`)}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={t('common.continue')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            style={styles.submitButton}
            testID="profile-setup-submit"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  content: {
    paddingTop: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 36,
  },
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  purposeChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  submitButton: {
    marginTop: 8,
  },
});
