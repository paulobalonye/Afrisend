'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { TransactionStatusBadge } from '@/components/ui/TransactionStatusBadge';
import { useRemittanceStore } from '@/lib/store/remittanceStore';
import { getPaymentStatus } from '@/lib/api/fx';
import type { Payment } from '@/types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // 2 minutes

export default function ProcessingPage() {
  const router = useRouter();
  const { currentPayment, resetFlow } = useRemittanceStore();
  const [payment, setPayment] = useState<Payment | null>(currentPayment);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!payment) {
      router.replace('/send/recipient');
      return;
    }

    if (payment.status === 'completed' || payment.status === 'failed' || payment.status === 'cancelled') {
      return;
    }

    if (polls >= MAX_POLLS) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await getPaymentStatus(payment.id);
        setPayment(updated);
        setPolls((p) => p + 1);
      } catch {
        setPolls((p) => p + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [payment, polls, router]);

  function handleDone() {
    resetFlow();
    router.push('/dashboard');
  }

  function handleViewHistory() {
    resetFlow();
    router.push('/history');
  }

  if (!payment) return null;

  const isTerminal =
    payment.status === 'completed' ||
    payment.status === 'failed' ||
    payment.status === 'cancelled';

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="py-8">
        {payment.status === 'completed' && (
          <div className="text-6xl mb-4">🎉</div>
        )}
        {payment.status === 'processing' || payment.status === 'pending' ? (
          <div className="flex justify-center mb-4">
            <span className="h-12 w-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : null}
        {payment.status === 'failed' && (
          <div className="text-6xl mb-4">❌</div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {payment.status === 'completed' && 'Money sent!'}
          {payment.status === 'processing' && 'Processing…'}
          {payment.status === 'pending' && 'Payment received'}
          {payment.status === 'failed' && 'Transfer failed'}
          {payment.status === 'cancelled' && 'Transfer cancelled'}
        </h1>

        <div className="flex justify-center mb-4">
          <TransactionStatusBadge status={payment.status} />
        </div>

        {payment.status === 'failed' && payment.failureReason && (
          <p className="text-sm text-red-600">{payment.failureReason}</p>
        )}

        {!isTerminal && (
          <p className="text-sm text-gray-500">
            We&apos;ll notify you when the transfer completes
          </p>
        )}
      </div>

      {isTerminal && (
        <div className="flex flex-col gap-3">
          <Button label="Done" onClick={handleDone} fullWidth />
          <Button label="View history" variant="secondary" onClick={handleViewHistory} fullWidth />
        </div>
      )}
    </div>
  );
}
