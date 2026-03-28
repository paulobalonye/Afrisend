'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useRemittanceStore } from '@/lib/store/remittanceStore';
import { initiatePayment } from '@/lib/api/fx';
import type { PaymentMethod } from '@/types';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReviewPage() {
  const router = useRouter();
  const { currentQuote, recipient, setCurrentPayment } = useRemittanceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentQuote || !recipient) {
    router.replace('/send/recipient');
    return null;
  }

  const paymentMethod =
    (typeof window !== 'undefined' && (sessionStorage.getItem('paymentMethod') as PaymentMethod)) ||
    'open_banking';

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);
    try {
      const payment = await initiatePayment({
        quoteId: currentQuote!.quoteId,
        recipientId: recipient!.id,
        paymentMethod,
        idempotencyKey: crypto.randomUUID(),
      });
      setCurrentPayment(payment);
      router.push('/send/processing');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to initiate payment');
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="text-xl font-bold text-gray-900">Step 4 of 5 — Review</h1>
        <p className="text-sm text-gray-500 mt-1">Check the details before confirming</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        <Row label="Recipient" value={`${recipient.firstName} ${recipient.lastName}`} />
        <Row label="Nickname" value={recipient.nickname} />
        <Row label="Destination" value={recipient.country} />
        <Row
          label="You send"
          value={`${formatNumber(currentQuote.sourceAmount)} ${currentQuote.sourceCurrency}`}
        />
        <Row
          label="They receive"
          value={`${formatNumber(currentQuote.destinationAmount)} ${currentQuote.destinationCurrency}`}
          highlight
        />
        <Row
          label="Exchange rate"
          value={`1 ${currentQuote.sourceCurrency} = ${formatNumber(currentQuote.exchangeRate)} ${currentQuote.destinationCurrency}`}
        />
        <Row label="Fee" value={`${formatNumber(currentQuote.fee)} ${currentQuote.sourceCurrency}`} />
        <Row
          label="Total cost"
          value={`${formatNumber(currentQuote.totalSourceAmount)} ${currentQuote.sourceCurrency}`}
          strong
        />
      </div>

      <Button
        label="Confirm & Send"
        onClick={handleConfirm}
        isLoading={isSubmitting}
        fullWidth
      />
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  strong,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={[
          'text-sm',
          highlight ? 'text-brand-600 font-bold text-base' : '',
          strong ? 'font-semibold text-gray-900' : 'text-gray-800',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
