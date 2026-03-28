'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RecipientCard } from '@/components/ui/RecipientCard';
import { Button } from '@/components/ui/Button';
import { RecipientForm } from '@/components/ui/RecipientForm';
import { getRecipients, deleteRecipient } from '@/lib/api/recipients';
import type { Recipient } from '@/types';

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Recipient | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    getRecipients()
      .then(setRecipients)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this recipient?')) return;
    try {
      await deleteRecipient(id);
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function handleEdit(r: Recipient) {
    setEditTarget(r);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditTarget(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recipients</h1>
        <Button label="+ Add recipient" onClick={() => setShowForm(true)} />
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <RecipientForm recipient={editTarget} onClose={handleFormClose} />
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No recipients yet</p>
          <p className="text-sm text-gray-400 mt-1">Add someone to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipients.map((r) => (
            <RecipientCard
              key={r.id}
              recipient={r}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
