'use client';

import React, { useEffect, useState } from 'react';
import {
  listFxCorridors,
  updateCorridorMarkup,
  type CorridorMarkupView,
} from '@/lib/api/admin';

export default function AdminFxPage() {
  const [corridors, setCorridors] = useState<CorridorMarkupView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CorridorMarkupView | null>(null);
  const [editMarkupBps, setEditMarkupBps] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);

  async function fetchCorridors() {
    setLoading(true);
    setError(null);
    try {
      const data = await listFxCorridors();
      setCorridors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load corridors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCorridors();
  }, []);

  function openEdit(corridor: CorridorMarkupView) {
    setEditTarget(corridor);
    setEditMarkupBps(String(corridor.markupBps));
  }

  async function handleSave() {
    if (!editTarget) return;
    const bps = Number(editMarkupBps);
    if (!Number.isFinite(bps) || bps < 0) {
      setError('Markup must be a non-negative number');
      return;
    }
    setEditLoading(true);
    try {
      await updateCorridorMarkup(editTarget.id, bps);
      setEditTarget(null);
      await fetchCorridors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">FX Rate Management</h1>
        <p className="text-sm text-gray-500 mt-1">Configure corridor markups and fee structures</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Corridors grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading corridors…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {corridors.map((corridor) => (
            <div key={corridor.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {corridor.fromCurrency} → {corridor.toCurrency}
                  </div>
                  <div className="text-xs text-gray-400 capitalize mt-0.5">{corridor.feeStructure} fee</div>
                </div>
                <span className="bg-brand-50 text-brand-700 text-sm font-semibold rounded-full px-2.5 py-1">
                  {corridor.markupBps} bps
                </span>
              </div>

              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Min fee</span>
                  <span className="font-medium">{corridor.fromCurrency} {corridor.minFee.toFixed(2)}</span>
                </div>
                {corridor.maxFee !== null && (
                  <div className="flex justify-between">
                    <span>Max fee</span>
                    <span className="font-medium">{corridor.fromCurrency} {corridor.maxFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Effective rate</span>
                  <span className="font-medium">{(corridor.markupBps / 100).toFixed(2)}%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEdit(corridor)}
                className="w-full rounded-lg border border-brand-300 text-brand-700 px-4 py-2 text-sm font-medium hover:bg-brand-50 transition-colors"
              >
                Edit Markup
              </button>
            </div>
          ))}
        </div>
      )}

      {corridors.length === 0 && !loading && (
        <p className="text-gray-400 text-sm text-center py-8">No corridors configured</p>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-1">Edit Corridor Markup</h2>
            <p className="text-sm text-gray-500 mb-4">
              {editTarget.fromCurrency} → {editTarget.toCurrency}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Markup (basis points)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={editMarkupBps}
                onChange={(e) => setEditMarkupBps(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                1 bps = 0.01% — current: {editTarget.markupBps} bps = {(editTarget.markupBps / 100).toFixed(2)}%
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={editLoading}
                className="flex-1 rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {editLoading ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
