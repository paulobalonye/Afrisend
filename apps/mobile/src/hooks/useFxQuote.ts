import { useState, useEffect, useCallback } from 'react';
import { getRates } from '@/api/endpoints/yellowcard';
import type { RateQuote } from '@/api/endpoints/yellowcard';

type UseFxQuoteOptions = {
  corridorId: string;
  sourceAmount: number;
  enabled: boolean;
};

type UseFxQuoteResult = {
  quote: RateQuote | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useFxQuote({
  corridorId,
  sourceAmount,
  enabled,
}: UseFxQuoteOptions): UseFxQuoteResult {
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !corridorId || sourceAmount <= 0) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getRates({ corridorId, sourceAmount })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled, corridorId, sourceAmount, refreshToken]);

  return { quote, isLoading, error, refresh };
}
