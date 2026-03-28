import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useKycStore } from '@/store/kycStore';
import { getKycStatus } from '@/api/endpoints/kyc';
import type { KycStackParamList } from '@/navigation/KycNavigator';
import type { RootStackParamList } from '@/navigation/index';
import type { NativeStackNavigationProp as RootNavProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<KycStackParamList, 'KycStatus'>;

const POLLING_INTERVAL_MS = 5000;
const MAX_POLLS = 12; // 1 minute max

export function KycStatusScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = useNavigation<RootNavProp<RootStackParamList>>();
  const theme = useTheme();
  const { session, setSession } = useKycStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollCountRef = useRef(0);

  const status = session?.status ?? 'pending';

  useEffect(() => {
    if (status === 'pending' || status === 'processing') {
      startPulse();
      startPolling();
    }
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [status]);

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }

  function startPolling() {
    const timer = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      try {
        const updated = await getKycStatus();
        setSession(updated);
        if (updated.status !== 'pending' && updated.status !== 'processing') {
          clearInterval(timer);
        }
      } catch {
        // Polling errors are silent — user can manually retry
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(timer);
  }

  function handleSendMoney() {
    rootNavigation.navigate('Main');
  }

  const config = getStatusConfig(status, theme.colors);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.iconArea}>
          <Animated.View
            style={[
              styles.iconCircle,
              { backgroundColor: config.bgColor },
              (status === 'pending' || status === 'processing') && { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Typography style={styles.statusIcon}>{config.icon}</Typography>
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Typography variant="h2" style={{ color: theme.colors.text }} center>
            {t(config.titleKey)}
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.textSecondary, marginTop: 12 }}
            center
          >
            {t(config.subtitleKey)}
          </Typography>

          {status === 'rejected' && session?.rejectionReason && (
            <View
              style={[
                styles.rejectionNote,
                { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '30' },
              ]}
            >
              <Typography variant="bodySmall" style={{ color: theme.colors.error }}>
                {t('kyc.status.rejected.reason', { reason: session.rejectionReason })}
              </Typography>
            </View>
          )}

          {(status === 'pending' || status === 'processing') && (
            <View style={[styles.tiersInfo, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Typography variant="label" style={{ color: theme.colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Verification tiers
              </Typography>
              {(['tier1', 'tier2', 'tier3'] as const).map((tier) => (
                <View key={tier} style={styles.tierRow}>
                  <View style={[styles.tierBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Typography variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                      {t(`kyc.tiers.${tier}.name`)}
                    </Typography>
                  </View>
                  <View style={styles.tierDetails}>
                    <Typography variant="bodySmall" style={{ color: theme.colors.text }}>
                      {t(`kyc.tiers.${tier}.limit`)}
                    </Typography>
                    <Typography variant="caption" style={{ color: theme.colors.textSecondary }}>
                      {t(`kyc.tiers.${tier}.requirements`)}
                    </Typography>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {status === 'approved' && (
            <Button
              label={t('kyc.status.approved.sendMoney')}
              onPress={handleSendMoney}
              size="lg"
              testID="kyc-send-money-button"
            />
          )}
          {(status === 'rejected' || status === 'more_info_needed') && (
            <>
              <Button
                label={t('kyc.status.rejected.tryAgain')}
                onPress={() => navigation.navigate('KycIntro')}
                size="lg"
                testID="kyc-retry-button"
              />
              <Button
                label={t('kyc.status.rejected.support')}
                onPress={() => { /* Open support */ }}
                variant="outline"
                size="lg"
                style={{ marginTop: 12 }}
              />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

type StatusConfig = {
  icon: string;
  bgColor: string;
  titleKey: string;
  subtitleKey: string;
};

function getStatusConfig(
  status: string,
  colors: ReturnType<typeof useTheme>['colors'],
): StatusConfig {
  switch (status) {
    case 'approved':
      return {
        icon: '✅',
        bgColor: colors.success + '20',
        titleKey: 'kyc.status.approved.title',
        subtitleKey: 'kyc.status.approved.subtitle',
      };
    case 'rejected':
      return {
        icon: '❌',
        bgColor: colors.error + '20',
        titleKey: 'kyc.status.rejected.title',
        subtitleKey: 'kyc.status.rejected.subtitle',
      };
    case 'more_info_needed':
      return {
        icon: '📋',
        bgColor: colors.warning + '20',
        titleKey: 'kyc.status.moreInfoNeeded.title',
        subtitleKey: 'kyc.status.moreInfoNeeded.subtitle',
      };
    default:
      return {
        icon: '⏳',
        bgColor: colors.primary + '20',
        titleKey: 'kyc.status.pending.title',
        subtitleKey: 'kyc.status.pending.subtitle',
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 40,
  },
  iconArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    fontSize: 48,
  },
  content: {
    flex: 1,
    gap: 16,
  },
  rejectionNote: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  tiersInfo: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: 'center',
  },
  tierDetails: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: 0,
  },
});
