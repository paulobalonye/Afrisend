import { useState, useEffect, useCallback, useRef } from 'react';
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
  const refreshCountRef = useRef(0);

  const fetch = useCallback(async () => {
    if (!enabled || !corridorId || sourceAmount <= 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getRates({ corridorId, sourceAmount });
      setQuote(result);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, corridorId, sourceAmount]);

  const refresh = useCallback(() => {
    refreshCountRef.current += 1;
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch, refreshCountRef.current]);

  return { quote, isLoading, error, refresh };
}
