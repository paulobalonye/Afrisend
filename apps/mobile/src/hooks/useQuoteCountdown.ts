import { useState, useEffect } from 'react';

type QuoteCountdownResult = {
  secondsRemaining: number;
  isExpired: boolean;
  formattedTime: string;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useQuoteCountdown(expiresAt: string | null): QuoteCountdownResult {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return {
    secondsRemaining,
    isExpired: secondsRemaining === 0,
    formattedTime: formatTime(secondsRemaining),
  };
}
