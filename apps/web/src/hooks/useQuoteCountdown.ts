'use client';

import { useState, useEffect } from 'react';

type QuoteCountdown = {
  seconds: number;
  isExpired: boolean;
  formattedTime: string;
};

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function useQuoteCountdown(expiresAt: string | null): QuoteCountdown {
  const [seconds, setSeconds] = useState<number>(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(0);
      return;
    }

    const remaining = Math.max(
      0,
      Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000),
    );
    setSeconds(remaining);

    if (remaining <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return {
    seconds,
    isExpired: seconds <= 0 && expiresAt !== null,
    formattedTime: formatSeconds(seconds),
  };
}
