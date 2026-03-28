'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useRemittanceStore } from '@/lib/store/remittanceStore';
import type { PaymentMethod } from '@/types';

const methods: { value: PaymentMethod; label: string; description: string; icon: string }[] = [
  {
    value: 'open_banking',
    label: 'Open Banking',
    description: 'Instant bank transfer — no card fees',
    icon: '🏦',
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: '1–2 business days',
    icon: '💳',
  },
  {
    value: 'card',
    label: 'Debit / Credit Card',
    description: 'Instant — small card fee may apply',
    icon: '💰',
  },
];

export default function PaymentMethodPage() {
  const router = useRouter();
  const { currentQuote, recipient } = useRemittanceStore();
  const [selected, setSelected] = useState<PaymentMethod>('open_banking');

  if (!currentQuote || !recipient) {
    router.replace('/send/recipient');
    return null;
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
        <h1 className="text-xl font-bold text-gray-900">Step 3 of 5 — Payment method</h1>
        <p className="text-sm text-gray-500 mt-1">How would you like to pay?</p>
      </div>

      <div className="space-y-3">
        {methods.map((m) => (
          <button
            key={m.value}
            type="button"
            data-testid={`method-${m.value}`}
            onClick={() => setSelected(m.value)}
            className={[
              'w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-colors',
              selected === m.value
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 bg-white hover:bg-gray-50',
            ].join(' ')}
          >
            <span className="text-2xl">{m.icon}</span>
            <div>
              <p className="font-semibold text-gray-900">{m.label}</p>
              <p className="text-xs text-gray-500">{m.description}</p>
            </div>
            {selected === m.value && (
              <span className="ml-auto text-brand-500 text-xl">✓</span>
            )}
          </button>
        ))}
      </div>

      <Button
        label="Continue"
        onClick={() => {
          sessionStorage.setItem('paymentMethod', selected);
          router.push('/send/review');
        }}
        fullWidth
      />
    </div>
  );
}
