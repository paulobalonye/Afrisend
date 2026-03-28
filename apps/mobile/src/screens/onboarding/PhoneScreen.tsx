import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { sendOtp } from '@/api/endpoints/auth';
import { formatPhone } from '@/utils/validation';
import { appStorage } from '@/utils/storage';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Phone'>;

export function PhoneScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { setPendingPhone } = useAuthStore();

  const [phone, setPhone] = useState(appStorage.getLastKnownPhone() ?? '');
  const [countryCode, setCountryCode] = useState('+1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhone = `${countryCode}${formatPhone(phone)}`;

  async function handleSendCode() {
    if (phone.trim().length < 7) {
      setError(t('validation.invalidPhone'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await sendOtp({ phone: fullPhone, countryCode });
      setPendingPhone(fullPhone);
      appStorage.setLastKnownPhone(phone);
      navigation.navigate('Otp', { phone: fullPhone, sessionId: result.sessionId });
    } catch {
      setError(t('errors.network'));
    } finally {
      setIsLoading(false);
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
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface }]}>
            <Typography style={styles.icon}>📱</Typography>
          </View>

          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 20 }}>
            {t('onboarding.phone.title')}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 8 }}
          >
            {t('onboarding.phone.subtitle')}
          </Typography>

          {/* Phone input */}
          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={[
                styles.countryCodePicker,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Select country code"
            >
              <Typography variant="body" style={{ color: theme.colors.text }}>
                {countryCode}
              </Typography>
            </TouchableOpacity>

            <View style={styles.phoneInputWrapper}>
              <Input
                placeholder={t('onboarding.phone.placeholder')}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setError(null);
                }}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
                error={error ?? undefined}
                containerStyle={styles.phoneInputContainer}
                testID="phone-input"
              />
            </View>
          </View>

          <Button
            label={t('onboarding.phone.sendCode')}
            onPress={handleSendCode}
            loading={isLoading}
            disabled={phone.trim().length < 7}
            style={styles.sendButton}
            testID="send-code-button"
          />

          <Typography
            variant="caption"
            center
            style={{ color: theme.colors.textSecondary, marginTop: 16, paddingHorizontal: 8 }}
          >
            {t('onboarding.phone.disclaimer')}
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
    flex: 1,
    paddingTop: 24,
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
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    alignItems: 'flex-start',
  },
  countryCodePicker: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
    minWidth: 72,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInputContainer: {
    marginBottom: 0,
  },
  sendButton: {
    marginTop: 8,
  },
});
