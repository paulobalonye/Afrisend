'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipientCard } from '@/components/ui/RecipientCard';
import { Button } from '@/components/ui/Button';
import { useRemittanceStore } from '@/lib/store/remittanceStore';
import { getRecipients } from '@/lib/api/recipients';
import type { Recipient } from '@/types';

export default function SelectRecipientPage() {
  const router = useRouter();
  const { setRecipient } = useRemittanceStore();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecipients()
      .then(setRecipients)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = recipients.filter(
    (r) =>
      r.nickname.toLowerCase().includes(search.toLowerCase()) ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelect(recipient: Recipient) {
    setRecipient(recipient);
    router.push('/send/amount');
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand-600 mb-4 flex items-center gap-1 hover:text-brand-800"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Step 1 of 5 — Select recipient</h1>
        <p className="text-sm text-gray-500 mt-1">Who are you sending money to?</p>
      </div>

      <input
        type="search"
        placeholder="Search recipients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {isLoading && (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No recipients found</p>
          ) : (
            filtered.map((r) => (
              <RecipientCard key={r.id} recipient={r} onSelect={handleSelect} />
            ))
          )}
        </div>
      )}

      <Button
        label="Add new recipient"
        variant="secondary"
        onClick={() => router.push('/recipients?new=1')}
        fullWidth
      />
    </div>
  );
}
