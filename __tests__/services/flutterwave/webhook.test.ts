import { verifyWebhookSignature, parseWebhookEvent } from '@/services/flutterwave/webhook';
import type { WebhookEvent } from '@/services/flutterwave/types';

describe('verifyWebhookSignature', () => {
  const secretHash = 'test-secret-hash-abc123';

  it('returns true when the verif-hash header matches the secret hash', () => {
    expect(verifyWebhookSignature(secretHash, secretHash)).toBe(true);
  });

  it('returns false when the verif-hash header does not match', () => {
    expect(verifyWebhookSignature('wrong-hash', secretHash)).toBe(false);
  });

  it('returns false when the header is empty', () => {
    expect(verifyWebhookSignature('', secretHash)).toBe(false);
  });

  it('returns false when the secret hash is empty', () => {
    expect(verifyWebhookSignature('some-hash', '')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(verifyWebhookSignature('TEST-SECRET-HASH-ABC123', secretHash)).toBe(false);
  });
});

describe('parseWebhookEvent', () => {
  const validPayload: WebhookEvent = {
    event: 'transfer.completed',
    data: {
      id: 12345,
      tx_ref: 'ref-abc-001',
      status: 'SUCCESSFUL',
      amount: 5000,
      currency: 'NGN',
    },
  };

  it('parses a valid webhook JSON body', () => {
    const result = parseWebhookEvent(JSON.stringify(validPayload));
    expect(result).toEqual(validPayload);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseWebhookEvent('not-json')).toThrow('Invalid webhook payload');
  });

  it('throws when event field is missing', () => {
    const bad = JSON.stringify({ data: { id: 1, tx_ref: 'x', status: 'SUCCESSFUL', amount: 100, currency: 'NGN' } });
    expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
  });

  it('throws when data field is missing', () => {
    const bad = JSON.stringify({ event: 'transfer.completed' });
    expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
  });

  it('throws when data.tx_ref is missing', () => {
    const bad = JSON.stringify({ event: 'transfer.completed', data: { id: 1, status: 'SUCCESSFUL', amount: 100, currency: 'NGN' } });
    expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
  });
});
