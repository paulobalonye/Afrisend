'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import type { User } from '@/types';

type Tab = 'profile' | 'kyc' | 'security' | 'notifications';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: { value: Tab; label: string }[] = [
    { value: 'profile', label: 'Profile' },
    { value: 'kyc', label: 'Verification' },
    { value: 'security', label: 'Security' },
    { value: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveTab(t.value)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.value
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <ProfileTab user={user} />
      )}
      {activeTab === 'kyc' && (
        <KycTab kycStatus={user?.kycStatus ?? 'pending'} />
      )}
      {activeTab === 'security' && (
        <SecurityTab />
      )}
      {activeTab === 'notifications' && (
        <NotificationsTab />
      )}
    </div>
  );
}

function ProfileTab({ user }: { user: User | null }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Personal information</h2>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="First name" value={user?.firstName ?? '—'} />
          <InfoRow label="Last name" value={user?.lastName ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Phone" value={user?.phone ?? '—'} />
        </div>
        <p className="text-xs text-gray-400">
          To update your name or phone, please contact support.
        </p>
      </div>
    </div>
  );
}

function KycTab({ kycStatus }: { kycStatus: string }) {
  const statusConfig: Record<string, { label: string; colour: string; desc: string }> = {
    pending: {
      label: 'Not started',
      colour: 'text-gray-600 bg-gray-100',
      desc: 'You need to verify your identity before sending money.',
    },
    submitted: {
      label: 'Under review',
      colour: 'text-yellow-700 bg-yellow-100',
      desc: 'Your documents are being reviewed. This usually takes 1–2 business days.',
    },
    approved: {
      label: 'Verified',
      colour: 'text-green-700 bg-green-100',
      desc: 'Your identity has been verified. You can send up to £20,000 per month.',
    },
    rejected: {
      label: 'Rejected',
      colour: 'text-red-700 bg-red-100',
      desc: 'Your verification was rejected. Please contact support for assistance.',
    },
  };

  const cfg = statusConfig[kycStatus] ?? statusConfig.pending;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Identity verification</h2>
      <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${cfg.colour}`}>
        {cfg.label}
      </div>
      <p className="text-sm text-gray-600">{cfg.desc}</p>
      {kycStatus === 'pending' && (
        <button
          type="button"
          className="rounded-xl bg-brand-500 text-white px-6 py-3 text-sm font-semibold hover:bg-brand-600"
        >
          Start verification
        </button>
      )}
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Security</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Password</p>
            <p className="text-xs text-gray-500">Last changed: never</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            Change
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
            <p className="text-xs text-gray-500">OTP sent to your phone on each login</p>
          </div>
          <span className="text-xs text-green-600 font-medium bg-green-50 rounded-full px-2 py-0.5">
            Enabled
          </span>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    transferUpdates: true,
    marketing: false,
    rateAlerts: true,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Notification preferences</h2>
      <div className="space-y-3">
        {(
          [
            { key: 'transferUpdates', label: 'Transfer updates', desc: 'When your transfer status changes' },
            { key: 'rateAlerts', label: 'Rate alerts', desc: 'When FX rates improve significantly' },
            { key: 'marketing', label: 'Promotions', desc: 'Special offers and product updates' },
          ] as const
        ).map(({ key, label, desc }) => (
          <label
            key={key}
            className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              className="h-4 w-4 text-brand-600 rounded"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
