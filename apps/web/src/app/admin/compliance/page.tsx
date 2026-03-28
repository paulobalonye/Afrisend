'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FlagTypeBadge } from '@/components/admin/FlagTypeBadge';
import { TransactionStatusBadge } from '@/components/ui/TransactionStatusBadge';
import {
  listFlaggedTransactions,
  overrideTransactionStatus,
  type FlaggedTransaction,
  type FlagType,
} from '@/lib/api/admin';

const FLAG_TYPE_OPTIONS: Array<{ value: FlagType | ''; label: string }> = [
  { value: '', label: 'All flag types' },
  { value: 'aml_alert', label: 'AML Alert' },
  { value: 'sanctions_hit', label: 'Sanctions Hit' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'high_risk', label: 'High Risk' },
];

export default function AdminCompliancePage() {
  const [flagged, setFlagged] = useState<FlaggedTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [flagTypeFilter, setFlagTypeFilter] = useState<FlagType | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<FlaggedTransaction | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  const limit = 20;

  const fetchFlagged = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listFlaggedTransactions({
        flagType: flagTypeFilter || undefined,
        page,
        limit,
      });
      setFlagged(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance queue');
    } finally {
      setLoading(false);
    }
  }, [page, flagTypeFilter]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  async function handleOverride() {
    if (!overrideTarget || !overrideStatus || !overrideReason.trim()) return;
    setOverrideLoading(true);
    try {
      await overrideTransactionStatus(overrideTarget.id, overrideStatus, overrideReason);
      setOverrideTarget(null);
      setOverrideStatus('');
      setOverrideReason('');
      await fetchFlagged();
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Flagged transactions requiring review</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-sm font-semibold rounded-full px-3 py-1">
          {total} items
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select
          value={flagTypeFilter}
          onChange={(e) => { setFlagTypeFilter(e.target.value as FlagType | ''); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {FLAG_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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
                <th className="px-4 py-3 text-left font-medium text-gray-600">Transaction</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Flag</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Flagged At</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : flagged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No flagged transactions</td>
                </tr>
              ) : (
                flagged.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-500">{tx.id.slice(0, 8)}…</div>
                      <div className="text-gray-700 text-xs">{tx.userId}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {tx.sourceAmount.toLocaleString()} {tx.sourceCurrency}
                      <span className="text-gray-400 mx-1">→</span>
                      {tx.destinationAmount.toLocaleString()} {tx.destinationCurrency}
                    </td>
                    <td className="px-4 py-3"><TransactionStatusBadge status={tx.status} /></td>
                    <td className="px-4 py-3"><FlagTypeBadge flagType={tx.flagReason} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(tx.flaggedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => { setOverrideTarget(tx); setOverrideStatus(''); setOverrideReason(''); }}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Review
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
            <h2 className="text-lg font-semibold mb-2">Review Flagged Transaction</h2>
            <div className="flex items-center gap-2 mb-4">
              <FlagTypeBadge flagType={overrideTarget.flagReason} />
              <span className="text-sm text-gray-500 font-mono">{overrideTarget.id.slice(0, 8)}…</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action / New Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select status…</option>
                  <option value="completed">Approve (completed)</option>
                  <option value="cancelled">Reject (cancelled)</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Document your compliance review decision…"
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
                {overrideLoading ? 'Saving…' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
