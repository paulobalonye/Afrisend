import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { verifyOtp, sendOtp } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Otp'>;
type RoutePropType = RouteProp<OnboardingStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

export function OtpScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const theme = useTheme();
  const { setSessionId, setTemporaryToken } = useAuthStore();

  const { phone, sessionId } = route.params;

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startResendTimer();
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startResendTimer() {
    setResendCooldown(RESEND_COOLDOWN_SEC);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleVerify() {
    if (otp.length !== OTP_LENGTH) {
      setError(t('validation.invalidOtp'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await verifyOtp({ sessionId: currentSessionId, code: otp, phone });
      setSessionId(currentSessionId);
      setTemporaryToken(result.temporaryToken);

      if (result.isNewUser) {
        navigation.navigate('Register', { phone, temporaryToken: result.temporaryToken });
      } else {
        // Existing user — sign in flow
        navigation.navigate('ProfileSetup');
      }
    } catch {
      setError(t('validation.invalidOtp'));
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    try {
      const result = await sendOtp({ phone, countryCode: '' });
      setCurrentSessionId(result.sessionId);
      setOtp('');
      setError(null);
      startResendTimer();
      inputRef.current?.focus();
    } catch {
      setError(t('errors.network'));
    }
  }

  function handleOtpChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) {
      // Auto-submit when all digits entered
      setTimeout(() => handleVerifyWithCode(digits), 100);
    }
  }

  async function handleVerifyWithCode(code: string) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyOtp({ sessionId: currentSessionId, code, phone });
      setSessionId(currentSessionId);
      setTemporaryToken(result.temporaryToken);
      if (result.isNewUser) {
        navigation.navigate('Register', { phone, temporaryToken: result.temporaryToken });
      } else {
        navigation.navigate('ProfileSetup');
      }
    } catch {
      setError(t('validation.invalidOtp'));
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  }

  const displayPhone = phone.length > 8 ? `${phone.slice(0, 6)}***${phone.slice(-2)}` : phone;

  return (
    <Screen avoidKeyboard>
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
            <Typography style={styles.icon}>✉️</Typography>
          </View>

          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 20 }}>
            {t('onboarding.otp.title')}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 8 }}
          >
            {t('onboarding.otp.subtitle', { phone: displayPhone })}
          </Typography>

          {/* Hidden text input for OTP */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            testID="otp-input"
            accessibilityLabel="Enter verification code"
          />

          {/* OTP display boxes */}
          <TouchableOpacity
            onPress={() => inputRef.current?.focus()}
            style={styles.otpContainer}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Verification code input"
          >
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const digit = otp[index];
              const isFocused = otp.length === index;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    {
                      borderColor: error
                        ? theme.colors.error
                        : isFocused
                          ? theme.colors.borderFocus
                          : theme.colors.border,
                      backgroundColor: theme.colors.inputBackground,
                    },
                  ]}
                >
                  <Typography
                    variant="h3"
                    center
                    style={{ color: theme.colors.text }}
                  >
                    {digit ?? ''}
                  </Typography>
                </View>
              );
            })}
          </TouchableOpacity>

          {error && (
            <Typography
              variant="caption"
              center
              style={{ color: theme.colors.error, marginTop: 8 }}
              testID="otp-error"
            >
              {error}
            </Typography>
          )}

          <Button
            label={t('onboarding.otp.verify')}
            onPress={handleVerify}
            loading={isLoading}
            disabled={otp.length !== OTP_LENGTH}
            style={styles.verifyButton}
            testID="verify-otp-button"
          />

          {/* Resend */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            style={styles.resendButton}
            accessibilityRole="button"
          >
            <Typography
              variant="body"
              center
              style={{
                color: resendCooldown > 0 ? theme.colors.textDisabled : theme.colors.primary,
              }}
            >
              {resendCooldown > 0
                ? t('onboarding.otp.resendIn', { seconds: resendCooldown })
                : t('onboarding.otp.resend')}
            </Typography>
          </TouchableOpacity>
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
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    justifyContent: 'center',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButton: {
    marginTop: 28,
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
