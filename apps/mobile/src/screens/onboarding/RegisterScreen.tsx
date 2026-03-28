import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';
import { register as registerUser } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';
import { registerSchema, RegisterFormData } from '@/utils/validation';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Register'>;
type RoutePropType = RouteProp<OnboardingStackParamList, 'Register'>;

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const theme = useTheme();
  const { setUser } = useAuthStore();

  const { phone, temporaryToken } = route.params;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterFormData) {
    try {
      const result = await registerUser({
        temporaryToken,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });
      setUser(result.user);
      navigation.navigate('ProfileSetup');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.serverError');
      setError('email', { message });
    }
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
          <Typography variant="h2" style={{ color: theme.colors.text }}>
            {t('onboarding.register.title')}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 8, marginBottom: 28 }}
          >
            {t('onboarding.register.subtitle')}
          </Typography>

          {/* First + Last name row */}
          <View style={styles.nameRow}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t('onboarding.register.firstName')}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  error={errors.firstName ? t(errors.firstName.message ?? 'validation.required') : undefined}
                  containerStyle={styles.nameField}
                  testID="first-name-input"
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t('onboarding.register.lastName')}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  error={errors.lastName ? t(errors.lastName.message ?? 'validation.required') : undefined}
                  containerStyle={styles.nameField}
                  testID="last-name-input"
                />
              )}
            />
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.register.email')}
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email ? t(errors.email.message ?? 'validation.required') : undefined}
                testID="email-input"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.register.password')}
                value={value}
                onChangeText={onChange}
                isPassword
                error={errors.password ? t(errors.password.message ?? 'validation.required') : undefined}
                testID="password-input"
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('onboarding.register.confirmPassword')}
                value={value}
                onChangeText={onChange}
                isPassword
                error={errors.confirmPassword ? t(errors.confirmPassword.message ?? 'validation.required') : undefined}
                testID="confirm-password-input"
              />
            )}
          />

          <Button
            label={t('onboarding.register.createAccount')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            style={styles.createButton}
            testID="create-account-button"
          />

          {/* Phone display (pre-filled) */}
          <Typography
            variant="caption"
            center
            style={{ color: theme.colors.textSecondary, marginTop: 12 }}
          >
            Signing up with {phone}
          </Typography>
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  createButton: {
    marginTop: 8,
  },
});
