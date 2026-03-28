'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TransactionStatusBadge } from '@/components/ui/TransactionStatusBadge';
import { getTransactions } from '@/lib/api/transactions';
import type { Transaction, PaymentStatus } from '@/types';

const STATUS_FILTERS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Failed', value: 'failed' },
];

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const options = filter !== 'all' ? { status: filter } : {};
    getTransactions(options)
      .then(setTransactions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transaction history</h1>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={[
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No transactions found</p>
          <Link
            href="/send/recipient"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Send your first transfer →
          </Link>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between"
            >
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">{tx.recipientName}</p>
                <p className="text-sm text-gray-500">{formatDate(tx.createdAt)}</p>
                <TransactionStatusBadge status={tx.status} />
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold text-gray-900">
                  -{formatCurrency(tx.sourceAmount, tx.sourceCurrency)}
                </p>
                <p className="text-sm text-brand-600">
                  +{formatCurrency(tx.destinationAmount, tx.destinationCurrency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
