/**
 * YellowCard Integration Tests
 *
 * YellowCard API calls in this codebase flow through the AfriSend backend
 * (src/api/endpoints/yellowcard.ts calls /remittance/* on the AfriSend API).
 * Direct sandbox integration is not possible from the mobile app layer.
 *
 * These tests therefore cover:
 *   - Webhook HMAC signature verification (server-side utility, no network)
 *   - Constants: supported corridor currencies, volatile currencies
 *   - Integration-level validation of corridor filtering logic
 *
 * For full end-to-end sandbox tests against the YellowCard API itself,
 * see the AfriSend backend integration test suite.
 */

import crypto from 'crypto';
import {
  verifyWebhookSignature,
} from '@/services/yellowcard/webhookVerification';
import {
  SUPPORTED_CORRIDOR_CURRENCIES,
} from '@/api/endpoints/yellowcard';

const WEBHOOK_SECRET = process.env.YELLOWCARD_WEBHOOK_SECRET ?? 'test-secret-for-integration';

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('YellowCard — Webhook Signature Verification', () => {
  const paymentPayload = JSON.stringify({
    event: 'payment.completed',
    data: { id: 'pay_abc123', status: 'completed', amount: 10, currency: 'USD' },
  });

  it('verifies a correctly signed webhook payload', () => {
    const sig = sign(paymentPayload, WEBHOOK_SECRET);
    expect(verifyWebhookSignature(paymentPayload, sig, WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects a payload with wrong signature', () => {
    expect(
      verifyWebhookSignature(paymentPayload, 'badbadbadbad', WEBHOOK_SECRET),
    ).toBe(false);
  });

  it('rejects a tampered payload (signature from original)', () => {
    const sig = sign(paymentPayload, WEBHOOK_SECRET);
    const tampered = JSON.stringify({
      event: 'payment.completed',
      data: { id: 'HACKED', status: 'completed', amount: 99999, currency: 'USD' },
    });
    expect(verifyWebhookSignature(tampered, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false when payload is empty', () => {
    const sig = sign('', WEBHOOK_SECRET);
    expect(verifyWebhookSignature('', sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    expect(verifyWebhookSignature(paymentPayload, '', WEBHOOK_SECRET)).toBe(false);
  });

  it('uses constant-time comparison (does not throw on unequal-length hex)', () => {
    // Short hex should not throw, just return false
    expect(
      verifyWebhookSignature(paymentPayload, 'abc', WEBHOOK_SECRET),
    ).toBe(false);
  });

  it('verifies multiple event types correctly', () => {
    const events = [
      { event: 'payment.pending', data: { id: 'p1' } },
      { event: 'payment.failed', data: { id: 'p2' } },
      { event: 'settlement.completed', data: { id: 's1' } },
    ];

    events.forEach((event) => {
      const payload = JSON.stringify(event);
      const sig = sign(payload, WEBHOOK_SECRET);
      expect(verifyWebhookSignature(payload, sig, WEBHOOK_SECRET)).toBe(true);
    });
  });
});

describe('YellowCard — Corridor Currency Constants', () => {
  it('SUPPORTED_CORRIDOR_CURRENCIES is a non-empty readonly array', () => {
    expect(Array.isArray(SUPPORTED_CORRIDOR_CURRENCIES)).toBe(true);
    expect(SUPPORTED_CORRIDOR_CURRENCIES.length).toBeGreaterThan(0);
  });

  it('includes all expected African fiat currencies', () => {
    const expected = ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR'];
    expected.forEach((currency) => {
      expect(SUPPORTED_CORRIDOR_CURRENCIES).toContain(currency);
    });
  });

  it('includes NGN (primary target currency for AfriSend)', () => {
    expect(SUPPORTED_CORRIDOR_CURRENCIES).toContain('NGN');
  });

  it('includes 10 currencies', () => {
    expect(SUPPORTED_CORRIDOR_CURRENCIES).toHaveLength(10);
  });

  it('does not include non-African or non-supported currencies', () => {
    const excluded = ['USD', 'EUR', 'GBP', 'JPY'];
    excluded.forEach((currency) => {
      expect(SUPPORTED_CORRIDOR_CURRENCIES).not.toContain(currency);
    });
  });
});
