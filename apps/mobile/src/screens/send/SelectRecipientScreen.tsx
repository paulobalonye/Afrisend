import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';
import { getRecipients } from '@/api/endpoints/recipients';
import { useRemittanceStore } from '@/store/remittanceStore';
import type { Recipient } from '@/api/endpoints/recipients';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';

type NavigationProp = NativeStackNavigationProp<SendStackParamList>;

export function SelectRecipientScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const setRecipient = useRemittanceStore((s) => s.setRecipient);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getRecipients()
      .then((data) => {
        if (!cancelled) setRecipients(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return recipients;
    const q = search.toLowerCase();
    return recipients.filter(
      (r) =>
        r.nickname.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q),
    );
  }, [recipients, search]);

  function handleSelect(recipient: Recipient) {
    setRecipient({
      name: `${recipient.firstName} ${recipient.lastName}`,
      accountNumber:
        'accountDetails' in recipient &&
        'accountNumber' in (recipient.accountDetails as Record<string, unknown>)
          ? (recipient.accountDetails as { accountNumber: string }).accountNumber
          : '',
      bankCode:
        'accountDetails' in recipient &&
        'bankCode' in (recipient.accountDetails as Record<string, unknown>)
          ? (recipient.accountDetails as { bankCode: string }).bankCode
          : '',
      bankName:
        'accountDetails' in recipient &&
        'bankName' in (recipient.accountDetails as Record<string, unknown>)
          ? (recipient.accountDetails as { bankName: string }).bankName
          : '',
    });
    navigation.navigate('SendAmount', { recipientId: recipient.id });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Typography variant="h3" style={{ color: theme.colors.text }}>
          {t('send.step1.title')}
        </Typography>
        <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
          {t('send.step1.subtitle')}
        </Typography>
      </View>

      <View style={[styles.searchWrapper, { borderColor: theme.colors.border }]}>
        <TextInput
          testID="recipient-search-input"
          placeholder={t('send.step1.searchPlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
      </View>

      {isLoading && (
        <View testID="loading-skeleton" style={styles.skeletonContainer}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={72} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centeredMessage}>
          <Typography style={{ color: theme.colors.error }}>
            {t('common.error')}
          </Typography>
        </View>
      )}

      {!isLoading && !error && filtered.length === 0 && search.trim() !== '' && (
        <View style={styles.centeredMessage}>
          <Typography style={{ color: theme.colors.textSecondary }}>
            No recipients found
          </Typography>
        </View>
      )}

      {!isLoading && !error && recipients.length === 0 && (
        <View style={styles.centeredMessage}>
          <Typography style={{ color: theme.colors.textSecondary }}>
            {t('recipients.empty')}
          </Typography>
        </View>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.recipientRow,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
            >
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                <Typography style={{ color: theme.colors.primary, fontWeight: '700' }}>
                  {item.firstName[0]}
                  {item.lastName[0]}
                </Typography>
              </View>
              <View style={styles.recipientInfo}>
                <Typography variant="body" style={{ color: theme.colors.text, fontWeight: '600' }}>
                  {item.nickname || `${item.firstName} ${item.lastName}`}
                </Typography>
                <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                  {item.country} · {item.payoutMethod === 'mobile_money' ? 'Mobile money' : 'Bank transfer'}
                </Typography>
              </View>
              <Typography style={{ color: theme.colors.textSecondary, fontSize: 18 }}>›</Typography>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        testID="add-recipient-button"
        style={[styles.addButton, { borderColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddRecipient')}
        accessibilityRole="button"
      >
        <Typography style={{ color: theme.colors.primary, fontWeight: '600' }}>
          + {t('send.step1.addNew')}
        </Typography>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  searchWrapper: {
    marginHorizontal: 24,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    fontSize: 15,
  },
  skeletonContainer: {
    paddingHorizontal: 24,
    gap: 10,
  },
  skeletonItem: {
    marginBottom: 0,
  },
  list: {
    paddingHorizontal: 24,
    gap: 10,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientInfo: {
    flex: 1,
    gap: 2,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  addButton: {
    margin: 24,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
});
