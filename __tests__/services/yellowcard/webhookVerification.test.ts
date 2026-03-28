import {
  verifyWebhookSignature,
} from '../../../src/services/yellowcard/webhookVerification';
import crypto from 'crypto';

function computeExpectedSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const WEBHOOK_SECRET = 'test_yellowcard_webhook_secret_xyz';

describe('verifyWebhookSignature', () => {
  it('returns true for a valid HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed', data: { id: 'pay_123' } });
    const validSig = computeExpectedSignature(payload, WEBHOOK_SECRET);

    expect(verifyWebhookSignature(payload, validSig, WEBHOOK_SECRET)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed', data: { id: 'pay_123' } });
    const invalidSig = 'deadbeefdeadbeefdeadbeefdeadbeef';

    expect(verifyWebhookSignature(payload, invalidSig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false when payload is tampered after signing', () => {
    const original = JSON.stringify({ event: 'payment.completed', data: { id: 'pay_123' } });
    const tampered = JSON.stringify({ event: 'payment.completed', data: { id: 'HACKED' } });
    const sig = computeExpectedSignature(original, WEBHOOK_SECRET);

    expect(verifyWebhookSignature(tampered, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false for empty signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed' });
    expect(verifyWebhookSignature(payload, '', WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false for empty payload', () => {
    const sig = computeExpectedSignature('', WEBHOOK_SECRET);
    expect(verifyWebhookSignature('', sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false for non-hex signature (causes Buffer length mismatch)', () => {
    const payload = JSON.stringify({ event: 'payment.completed' });
    expect(verifyWebhookSignature(payload, 'not-valid-hex!!', WEBHOOK_SECRET)).toBe(false);
  });

  it('uses constant-time comparison — signature one char off should fail', () => {
    const payload = JSON.stringify({ event: 'payment.failed', data: { id: 'pay_999' } });
    const validSig = computeExpectedSignature(payload, WEBHOOK_SECRET);
    const offBySig = validSig.slice(0, -1) + (validSig.endsWith('0') ? '1' : '0');

    expect(verifyWebhookSignature(payload, validSig, WEBHOOK_SECRET)).toBe(true);
    expect(verifyWebhookSignature(payload, offBySig, WEBHOOK_SECRET)).toBe(false);
  });

  it('returns false when wrong secret is used', () => {
    const payload = JSON.stringify({ event: 'payment.completed', data: { id: 'pay_456' } });
    const sig = computeExpectedSignature(payload, WEBHOOK_SECRET);

    expect(verifyWebhookSignature(payload, sig, 'wrong_secret')).toBe(false);
  });

  it('correctly handles unicode payload content', () => {
    const payload = JSON.stringify({ event: 'payment.completed', note: 'Naïve café ₦' });
    const sig = computeExpectedSignature(payload, WEBHOOK_SECRET);

    expect(verifyWebhookSignature(payload, sig, WEBHOOK_SECRET)).toBe(true);
  });
});
