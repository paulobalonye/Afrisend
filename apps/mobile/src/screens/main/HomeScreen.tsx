import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import type { MainStackParamList } from '@/navigation/MainNavigator';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { user, signOut } = useAuthStore();

  const kycVerified = user?.kycStatus === 'approved';
  const kycTier = user?.kycTier ?? 0;

  return (
    <Screen scrollable>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View>
          <Typography variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Welcome back,
          </Typography>
          <Typography variant="h3" style={{ color: '#FFF' }}>
            {user?.firstName ?? 'User'} 👋
          </Typography>
        </View>
        <TouchableOpacity
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.signOutButton}
        >
          <Typography variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Sign out
          </Typography>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* KYC status banner */}
        {!kycVerified && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Kyc')}
            style={[
              styles.kycBanner,
              { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent },
            ]}
            accessibilityRole="button"
            testID="kyc-banner"
          >
            <Typography style={styles.kycBannerIcon}>🔐</Typography>
            <View style={styles.kycBannerText}>
              <Typography variant="body" style={{ color: theme.colors.text, fontWeight: '600' }}>
                Verify your identity
              </Typography>
              <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                {kycTier === 0
                  ? 'Complete KYC to start sending money'
                  : `Current limit: ${t(`kyc.tiers.tier${kycTier as 1 | 2 | 3}.limit`)}`}
              </Typography>
            </View>
            <Typography style={{ color: theme.colors.primary, fontSize: 18 }}>→</Typography>
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Typography variant="h4" style={{ color: theme.colors.text, marginBottom: 16 }}>
            Quick actions
          </Typography>
          <View style={styles.actionsGrid}>
            {[
              { icon: '💸', label: 'Send money', testID: 'send-money-action', onPress: () => navigation.navigate('SendMoney') },
              { icon: '📊', label: 'Transactions', testID: 'transactions-action', onPress: () => navigation.navigate('TransactionHistory') },
              { icon: '👥', label: 'Recipients', testID: 'recipients-action', onPress: () => {} },
              { icon: '⚙️', label: 'Settings', testID: 'settings-action', onPress: () => {} },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[
                  styles.actionCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
                accessibilityRole="button"
                testID={action.testID}
                onPress={action.onPress}
              >
                <Typography style={styles.actionIcon}>{action.icon}</Typography>
                <Typography variant="bodySmall" style={{ color: theme.colors.text }} center>
                  {action.label}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* KYC tier info */}
        <View style={[styles.tierCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.tierCardHeader}>
            <Typography variant="body" style={{ color: theme.colors.text, fontWeight: '600' }}>
              Your account tier
            </Typography>
            {kycVerified && (
              <Typography variant="caption" style={{ color: theme.colors.success, fontWeight: '600' }}>
                ✓ Verified
              </Typography>
            )}
          </View>
          <Typography variant="h4" style={{ color: theme.colors.primary, marginTop: 4 }}>
            {kycTier === 0 ? 'Unverified' : t(`kyc.tiers.tier${kycTier as 1 | 2 | 3}.name`)}
          </Typography>
          <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
            {kycTier === 0
              ? 'No sending limit until verified'
              : t(`kyc.tiers.tier${kycTier as 1 | 2 | 3}.limit`)}
          </Typography>
          {!kycVerified && (
            <Button
              label="Upgrade now"
              onPress={() => navigation.navigate('Kyc')}
              variant="outline"
              size="sm"
              fullWidth={false}
              style={styles.upgradeButton}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  signOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  kycBannerIcon: {
    fontSize: 28,
  },
  kycBannerText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: 0,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '46%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 32,
  },
  tierCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 0,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeButton: {
    marginTop: 12,
  },
});
