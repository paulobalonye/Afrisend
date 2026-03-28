'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {user?.firstName ?? 'there'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Send money to Africa instantly</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/send/recipient"
          className="flex flex-col items-center gap-2 rounded-2xl bg-brand-500 text-white p-6 shadow-sm hover:bg-brand-600 transition-colors"
        >
          <span className="text-3xl">💸</span>
          <span className="font-semibold text-sm">Send Money</span>
        </Link>

        <Link
          href="/history"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-200 text-gray-700 p-6 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <span className="text-3xl">📋</span>
          <span className="font-semibold text-sm">History</span>
        </Link>

        <Link
          href="/recipients"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-200 text-gray-700 p-6 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <span className="text-3xl">👥</span>
          <span className="font-semibold text-sm">Recipients</span>
        </Link>

        <Link
          href="/settings"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-200 text-gray-700 p-6 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <span className="text-3xl">⚙️</span>
          <span className="font-semibold text-sm">Settings</span>
        </Link>
      </div>

      {/* KYC status banner */}
      {user && user.kycStatus !== 'approved' && (
        <div className="rounded-xl bg-gold-400/20 border border-gold-400 p-4">
          <p className="text-sm font-medium text-gray-800">
            {user.kycStatus === 'pending'
              ? 'Complete identity verification to start sending'
              : user.kycStatus === 'submitted'
              ? 'Your identity verification is under review'
              : 'Identity verification rejected — please contact support'}
          </p>
          {user.kycStatus === 'pending' && (
            <Link
              href="/settings?tab=kyc"
              className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline"
            >
              Verify now →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
