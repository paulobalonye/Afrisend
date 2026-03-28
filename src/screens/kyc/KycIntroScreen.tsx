import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useKycStore } from '@/store/kycStore';
import { startKycSession } from '@/api/endpoints/kyc';
import type { KycStackParamList } from '@/navigation/KycNavigator';

type NavigationProp = NativeStackNavigationProp<KycStackParamList, 'KycIntro'>;

type KycStepInfo = {
  icon: string;
  labelKey: string;
};

const KYC_STEPS: KycStepInfo[] = [
  { icon: '🪪', labelKey: 'kyc.intro.steps.id' },
  { icon: '🤳', labelKey: 'kyc.intro.steps.selfie' },
  { icon: '🏠', labelKey: 'kyc.intro.steps.address' },
];

export function KycIntroScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { setSession, setLoading, setError } = useKycStore();
  const [isStarting, setIsStarting] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);

  async function handleStart() {
    setIsStarting(true);
    try {
      const session = await startKycSession();
      setSession(session);
      navigation.navigate('IdUpload');
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Shield icon */}
        <View style={[styles.shieldContainer, { backgroundColor: theme.colors.primary }]}>
          <Typography style={styles.shieldIcon}>🛡️</Typography>
        </View>

        <View style={styles.content}>
          <Typography variant="h2" style={{ color: theme.colors.text }} center>
            {t('kyc.intro.title')}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 12, lineHeight: 22 }}
            center
          >
            {t('kyc.intro.subtitle')}
          </Typography>

          {/* Steps */}
          <View style={[styles.stepsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {KYC_STEPS.map((step, index) => (
              <View key={step.labelKey} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepNumberBadge,
                    { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' },
                  ]}
                >
                  <Typography style={styles.stepIcon}>{step.icon}</Typography>
                </View>
                <View style={styles.stepTextContainer}>
                  <Typography variant="body" style={{ color: theme.colors.text, fontWeight: '500' }}>
                    {t(step.labelKey)}
                  </Typography>
                </View>
                {index < KYC_STEPS.length - 1 && (
                  <View style={[styles.stepConnector, { backgroundColor: theme.colors.border }]} />
                )}
              </View>
            ))}
          </View>

          <Typography
            variant="caption"
            center
            style={{ color: theme.colors.textSecondary }}
          >
            ⏱ {t('kyc.intro.timeEstimate')}
          </Typography>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label={t('kyc.intro.startVerification')}
            onPress={handleStart}
            loading={isStarting}
            size="lg"
            testID="start-kyc-button"
          />
          <TouchableOpacity
            onPress={() => setShowWhyModal(true)}
            style={styles.whyLink}
            accessibilityRole="button"
          >
            <Typography variant="body" style={{ color: theme.colors.primary }} center>
              {t('kyc.intro.why')}
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {/* "Why" explanation modal */}
      <Modal
        visible={showWhyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWhyModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setShowWhyModal(false)}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close explanation"
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
            <Typography variant="h4" style={{ color: theme.colors.text, marginBottom: 12 }}>
              {t('kyc.intro.why')}
            </Typography>
            <Typography variant="body" style={{ color: theme.colors.textSecondary, lineHeight: 24 }}>
              {t('kyc.intro.whyExplained')}
            </Typography>
            <Button
              label={t('common.done')}
              onPress={() => setShowWhyModal(false)}
              style={{ marginTop: 24 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  shieldContainer: {
    width: '100%',
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  shieldIcon: {
    fontSize: 56,
  },
  content: {
    flex: 1,
    paddingTop: 28,
    gap: 20,
  },
  stepsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    fontSize: 22,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepConnector: {
    position: 'absolute',
    left: 21,
    top: 44,
    width: 2,
    height: 16,
  },
  actions: {
    gap: 12,
  },
  whyLink: {
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
});
