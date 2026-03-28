import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography } from './Typography';
import { Card } from './Card';

export type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
  /** Account/phone number used to send */
  accountIdentifier?: string;
  /** ISO country code, e.g. 'NG' */
  country?: string;
  /** e.g. 'bank_transfer', 'mobile_money' */
  paymentMethod?: string;
  /** Bank or wallet name */
  institutionName?: string;
};

type RecipientCardProps = {
  recipient: Recipient;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  NG: '🇳🇬',
  GH: '🇬🇭',
  KE: '🇰🇪',
  ZA: '🇿🇦',
  TZ: '🇹🇿',
  UG: '🇺🇬',
  SN: '🇸🇳',
  CI: '🇨🇮',
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function RecipientCard({
  recipient,
  onPress,
  selected = false,
  style,
  testID,
}: RecipientCardProps) {
  const theme = useTheme();

  const avatarBg = selected ? theme.colors.primary : theme.colors.surfaceSecondary;
  const avatarText = selected ? '#FFF' : theme.colors.textSecondary;
  const borderStyle = selected
    ? { borderColor: theme.colors.primary, borderWidth: 2 }
    : {};

  const flag = recipient.country ? (COUNTRY_FLAGS[recipient.country] ?? '🌍') : null;
  const fullName = `${recipient.firstName} ${recipient.lastName}`;
  const initials = getInitials(recipient.firstName, recipient.lastName);

  return (
    <Card
      onPress={onPress}
      style={[borderStyle, style]}
      testID={testID}
      accessibilityLabel={`Recipient: ${fullName}`}
    >
      <View style={styles.row}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Typography
            variant="body"
            style={{ color: avatarText, fontWeight: '700' }}
          >
            {initials}
          </Typography>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Typography variant="body" style={{ color: theme.colors.text, fontWeight: '600' }}>
              {fullName}
            </Typography>
            {flag && (
              <Typography style={styles.flag}>{flag}</Typography>
            )}
          </View>
          {recipient.institutionName && (
            <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
              {recipient.institutionName}
            </Typography>
          )}
          {recipient.accountIdentifier && (
            <Typography variant="caption" style={{ color: theme.colors.textDisabled }}>
              {recipient.accountIdentifier}
            </Typography>
          )}
        </View>

        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: theme.colors.primary }]}>
            <Typography style={{ color: '#FFF', fontSize: 12 }}>✓</Typography>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flag: {
    fontSize: 16,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
