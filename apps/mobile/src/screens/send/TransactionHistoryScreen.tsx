import React, { useState, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme';
import { getTransactions } from '@/api/endpoints/transactions';
import type { Transaction } from '@/api/endpoints/transactions';
import type { PaymentStatus } from '@/api/endpoints/yellowcard';
import type { SendStackParamList } from '@/navigation/SendMoneyNavigator';

type NavigationProp = NativeStackNavigationProp<SendStackParamList>;

type StatusFilter = 'all' | PaymentStatus;

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'processing', 'completed', 'failed'];

const STATUS_BADGE_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'error' | 'info'> = {
  completed: 'success',
  pending: 'warning',
  processing: 'info',
  failed: 'error',
  cancelled: 'error',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function TransactionHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getTransactions()
      .then((data) => {
        if (!cancelled) setTransactions(data);
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
    if (activeFilter === 'all') return transactions;
    return transactions.filter((tx) => tx.status === activeFilter);
  }, [transactions, activeFilter]);

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Typography style={{ color: theme.colors.primary }}>← {t('common.back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h3" style={{ color: theme.colors.text, marginTop: 8 }}>
          {t('transactions.title')}
        </Typography>
      </View>

      {/* Status filter tabs */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Typography
                variant="caption"
                style={{ color: isActive ? '#FFF' : theme.colors.textSecondary, fontWeight: isActive ? '700' : '400' }}
              >
                {filter === 'all' ? t('transactions.filter.all') : t(`transactions.filter.${filter}`)}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && (
        <View testID="loading-skeleton" style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
          ))}
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centeredMessage}>
          <Typography style={{ color: theme.colors.error }}>{t('common.error')}</Typography>
        </View>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <View style={styles.centeredMessage}>
          <Typography style={{ fontSize: 48 }}>📭</Typography>
          <Typography variant="body" style={{ color: theme.colors.text, marginTop: 12 }}>
            {t('transactions.empty')}
          </Typography>
          <Typography variant="bodySmall" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
            {t('transactions.emptySubtitle')}
          </Typography>
        </View>
      )}

      {!isLoading && !error && transactions.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.txRow,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })}
              accessibilityRole="button"
            >
              <View style={styles.txLeft}>
                <Typography
                  variant="body"
                  style={{ color: theme.colors.text, fontWeight: '600' }}
                >
                  {item.recipientName}
                </Typography>
                <Typography variant="caption" style={{ color: theme.colors.textSecondary }}>
                  {formatDate(item.createdAt)}
                </Typography>
              </View>
              <View style={styles.txRight}>
                <Typography
                  variant="bodySmall"
                  style={{ color: theme.colors.text, fontWeight: '600' }}
                >
                  {item.sourceAmount.toFixed(2)} {item.sourceCurrency}
                </Typography>
                <Typography variant="caption" style={{ color: theme.colors.textSecondary }}>
                  → {formatNumber(item.destinationAmount)} {item.destinationCurrency}
                </Typography>
                <Badge
                  testID={`status-badge-${item.id}`}
                  label={t(`transactions.status.${item.status}`)}
                  variant={STATUS_BADGE_VARIANT[item.status] ?? 'info'}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 0,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  skeletonContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  list: {
    paddingHorizontal: 24,
    gap: 10,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  txLeft: {
    flex: 1,
    gap: 3,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
