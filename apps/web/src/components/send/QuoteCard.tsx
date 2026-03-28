'use client';

import type { RateQuote } from '@/types';

type Props = {
  quote: RateQuote;
  countdownSeconds: number;
};

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function QuoteCard({ quote, countdownSeconds }: Props) {
  const isExpired = countdownSeconds <= 0;

  const formattedTime = (() => {
    const m = Math.floor(countdownSeconds / 60);
    const s = countdownSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  })();

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">They receive</span>
        <span className="text-xl font-bold text-brand-600">
          {formatNumber(quote.destinationAmount)} {quote.destinationCurrency}
        </span>
      </div>

      <div className="h-px bg-gray-200" />

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Exchange rate</span>
        <span className="text-gray-800">
          1 {quote.sourceCurrency} = {formatNumber(quote.exchangeRate)} {quote.destinationCurrency}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Fee</span>
        <span className="text-gray-800">{quote.fee.toFixed(2)} {quote.sourceCurrency}</span>
      </div>

      <div
        data-testid="quote-countdown"
        className={`rounded-lg px-3 py-2 text-xs font-medium ${
          isExpired
            ? 'bg-red-50 text-red-500'
            : 'bg-brand-50 text-brand-700'
        }`}
      >
        {isExpired ? 'Rate expired — refresh to continue' : `Rate locked for ${formattedTime}`}
      </div>
    </div>
  );
}
