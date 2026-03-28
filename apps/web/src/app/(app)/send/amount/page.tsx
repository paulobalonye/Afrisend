'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QuoteCard } from '@/components/send/QuoteCard';
import { Button } from '@/components/ui/Button';
import { useRemittanceStore } from '@/lib/store/remittanceStore';
import { useQuoteCountdown } from '@/hooks/useQuoteCountdown';
import { listSupportedCorridors, getRates } from '@/lib/api/fx';
import type { Corridor } from '@/types';

const DEBOUNCE_MS = 500;

export default function AmountPage() {
  const router = useRouter();
  const {
    recipient,
    selectedCorridor,
    sourceAmount,
    currentQuote,
    setSelectedCorridor,
    setSourceAmount,
    setCurrentQuote,
  } = useRemittanceStore();

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [localAmount, setLocalAmount] = useState(sourceAmount);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const { seconds, isExpired } = useQuoteCountdown(currentQuote?.expiresAt ?? null);

  useEffect(() => {
    if (!recipient) {
      router.replace('/send/recipient');
      return;
    }
    listSupportedCorridors().then((cors) => {
      setCorridors(cors);
      const match = cors.find((c) => c.destinationCountry === recipient.country);
      if (match) setSelectedCorridor(match);
    });
  }, [recipient, router, setSelectedCorridor]);

  const fetchQuote = useCallback(async () => {
    const amount = parseFloat(localAmount);
    if (!selectedCorridor || !localAmount || isNaN(amount) || amount <= 0) {
      setCurrentQuote(null);
      return;
    }
    if (amount < selectedCorridor.minAmount) {
      setAmountError(`Minimum amount is ${selectedCorridor.minAmount} GBP`);
      setCurrentQuote(null);
      return;
    }
    if (amount > selectedCorridor.maxAmount) {
      setAmountError(`Maximum amount is ${selectedCorridor.maxAmount} GBP`);
      setCurrentQuote(null);
      return;
    }
    setAmountError(null);
    setIsLoadingQuote(true);
    setQuoteError(null);
    try {
      const quote = await getRates({
        corridorId: selectedCorridor.id,
        sourceAmount: amount,
      });
      setCurrentQuote(quote);
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : 'Failed to get rate');
      setCurrentQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [localAmount, selectedCorridor, setCurrentQuote]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  useEffect(() => {
    if (isExpired && currentQuote) fetchQuote();
  }, [isExpired, currentQuote, fetchQuote]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitised = e.target.value.replace(/[^0-9.]/g, '');
    setLocalAmount(sanitised);
    setSourceAmount(sanitised);
  }

  const isReady = !!currentQuote && !isLoadingQuote && !amountError;

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
        <h1 className="text-xl font-bold text-gray-900">Step 2 of 5 — Enter amount</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sending to <strong>{recipient?.nickname}</strong>
        </p>
      </div>

      {/* Amount input */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs text-gray-500 mb-2">You send (GBP)</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-400">£</span>
          <input
            data-testid="amount-input"
            type="text"
            inputMode="decimal"
            value={localAmount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className="flex-1 bg-transparent text-3xl font-bold text-gray-900 focus:outline-none"
          />
        </div>
        {amountError && (
          <p className="mt-2 text-xs text-red-600">{amountError}</p>
        )}
      </div>

      {isLoadingQuote && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          Getting best rate…
        </div>
      )}

      {currentQuote && !isLoadingQuote && (
        <QuoteCard quote={currentQuote} countdownSeconds={seconds} />
      )}

      {quoteError && (
        <p className="text-sm text-red-600">{quoteError}</p>
      )}

      <Button
        data-testid="next-button"
        label="Continue"
        onClick={() => router.push('/send/payment-method')}
        disabled={!isReady}
        fullWidth
      />
    </div>
  );
}
