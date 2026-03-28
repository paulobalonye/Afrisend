'use client';

import React, { useEffect, useState } from 'react';
import { getCorridorMetrics, type CorridorMetrics } from '@/lib/api/admin';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

function SuccessRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 95 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<CorridorMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCorridorMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const totalVolume = metrics.reduce((sum, m) => sum + m.totalVolume, 0);
  const totalTransactions = metrics.reduce((sum, m) => sum + m.transactionCount, 0);
  const avgSuccessRate =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Corridor Performance</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time metrics across all active corridors</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Summary stats */}
      {!loading && metrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Total Volume</div>
            <div className="text-2xl font-bold text-gray-900">
              {totalVolume.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">GBP equivalent</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Total Transactions</div>
            <div className="text-2xl font-bold text-gray-900">
              {totalTransactions.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Avg Success Rate</div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(avgSuccessRate * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Corridor table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Corridor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Volume</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Transactions</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">Success Rate</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Avg Processing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : metrics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No metrics available</td>
                </tr>
              ) : (
                metrics.map((m) => (
                  <tr key={m.corridorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {m.fromCurrency} → {m.toCurrency}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.totalVolume.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.transactionCount.toLocaleString()}</td>
                    <td className="px-4 py-3 w-40">
                      <SuccessRateBar rate={m.successRate} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDuration(m.avgProcessingTimeSec)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
