'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { verifyOtp } from '@/lib/api/auth';
import { setAccessToken, setRefreshToken } from '@/lib/auth/cookies';

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const router = useRouter();
  const { temporaryToken, setUser } = useAuthStore();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!temporaryToken) {
      router.replace('/auth/login');
    }
  }, [temporaryToken, router]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter the full code');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await verifyOtp({ sessionId: temporaryToken!, otp });
      setAccessToken(result.tokens.accessToken);
      setRefreshToken(result.tokens.refreshToken);
      setUser(result.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Verify your identity</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter the 6-digit code sent to your phone
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-3 justify-center" data-testid="otp-inputs">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-12 rounded-xl border border-gray-300 text-center text-xl font-bold
                  focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                aria-label={`OTP digit ${i + 1}`}
              />
            ))}
          </div>

          <Button
            type="submit"
            label="Verify"
            isLoading={isSubmitting}
            disabled={digits.join('').length < OTP_LENGTH}
            fullWidth
          />
        </form>
      </div>
    </div>
  );
}
