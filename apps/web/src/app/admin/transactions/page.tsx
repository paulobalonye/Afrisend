'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { TransactionStatusBadge } from '@/components/ui/TransactionStatusBadge';
import {
  listAdminTransactions,
  overrideTransactionStatus,
  type AdminTransaction,
  type ListTransactionsOptions,
} from '@/lib/api/admin';
import type { PaymentStatus } from '@/types';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const OVERRIDE_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'];

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<AdminTransaction | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  const limit = 20;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts: ListTransactionsOptions = { page, limit };
      if (statusFilter) opts.status = statusFilter as PaymentStatus;
      if (userIdFilter.trim()) opts.userId = userIdFilter.trim();
      const result = await listAdminTransactions(opts);
      setTransactions(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, userIdFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleOverride() {
    if (!overrideTarget || !overrideStatus || !overrideReason.trim()) return;
    setOverrideLoading(true);
    try {
      await overrideTransactionStatus(overrideTarget.id, overrideStatus, overrideReason);
      setOverrideTarget(null);
      setOverrideStatus('');
      setOverrideReason('');
      await fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Transaction Monitoring</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} transactions</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by user ID…"
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-48"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Destination</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transactions found</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-700">{tx.userId}</td>
                    <td className="px-4 py-3 font-medium">
                      {tx.sourceAmount.toLocaleString()} {tx.sourceCurrency}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tx.destinationAmount.toLocaleString()} {tx.destinationCurrency}
                    </td>
                    <td className="px-4 py-3">
                      <TransactionStatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => { setOverrideTarget(tx); setOverrideStatus(''); setOverrideReason(''); }}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Override modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Override Transaction Status</h2>
            <p className="text-sm text-gray-500 mb-4">
              Transaction: <span className="font-mono">{overrideTarget.id}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select status…</option>
                  {OVERRIDE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Explain why this override is needed…"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOverride}
                disabled={!overrideStatus || !overrideReason.trim() || overrideLoading}
                className="flex-1 rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {overrideLoading ? 'Saving…' : 'Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
