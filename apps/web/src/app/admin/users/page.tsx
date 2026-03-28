'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { KycTierBadge } from '@/components/admin/KycTierBadge';
import {
  listAdminUsers,
  updateAdminUser,
  type AdminUserView,
  type AccountStatus,
  type ListUsersOptions,
} from '@/lib/api/admin';

const KYC_STATUS_OPTIONS = [
  { value: '', label: 'All KYC statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const ACCOUNT_STATUS_OPTIONS: Array<{ value: AccountStatus | ''; label: string }> = [
  { value: '', label: 'All account statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kycStatusFilter, setKycStatusFilter] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUserView | null>(null);
  const [editKycTier, setEditKycTier] = useState<number>(0);
  const [editAccountStatus, setEditAccountStatus] = useState<AccountStatus>('active');
  const [editLoading, setEditLoading] = useState(false);

  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts: ListUsersOptions = { page, limit };
      if (kycStatusFilter) opts.kycStatus = kycStatusFilter;
      if (accountStatusFilter) opts.accountStatus = accountStatusFilter;
      const result = await listAdminUsers(opts);
      setUsers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, kycStatusFilter, accountStatusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openEdit(user: AdminUserView) {
    setEditTarget(user);
    setEditKycTier(user.kycTier);
    setEditAccountStatus(user.accountStatus);
  }

  async function handleSave() {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      await updateAdminUser(editTarget.id, {
        kycTier: editKycTier,
        accountStatus: editAccountStatus,
      });
      setEditTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} users</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <select
          value={kycStatusFilter}
          onChange={(e) => { setKycStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {KYC_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={accountStatusFilter}
          onChange={(e) => { setAccountStatusFilter(e.target.value as AccountStatus | ''); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {ACCOUNT_STATUS_OPTIONS.map((o) => (
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
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">KYC Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">KYC Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Monthly Limit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email ?? '—'}</td>
                    <td className="px-4 py-3"><KycTierBadge tier={user.kycTier} /></td>
                    <td className="px-4 py-3 capitalize text-gray-600">{user.kycStatus}</td>
                    <td className="px-4 py-3"><AdminStatusBadge status={user.accountStatus} /></td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.monthlyLimit.toLocaleString()} GBP
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Edit
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

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-1">Edit User</h2>
            <p className="text-sm text-gray-500 mb-4">
              {editTarget.firstName} {editTarget.lastName} ({editTarget.email})
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KYC Tier</label>
                <select
                  value={editKycTier}
                  onChange={(e) => setEditKycTier(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {[0, 1, 2, 3].map((t) => (
                    <option key={t} value={t}>Tier {t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                <select
                  value={editAccountStatus}
                  onChange={(e) => setEditAccountStatus(e.target.value as AccountStatus)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
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
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
