/**
 * Flutterwave Integration Tests — Sandbox Environment
 *
 * Tests run against the real Flutterwave sandbox API using `createFlutterwaveAdapter`.
 * Webhook verification tests are pure-function (no network required).
 *
 * Skipped automatically when FLUTTERWAVE_SECRET_KEY is not set — CI-safe.
 * Set FLUTTERWAVE_SECRET_KEY + FLUTTERWAVE_WEBHOOK_HASH in CI secrets to activate.
 *
 * All tests are idempotent and safe to run repeatedly against the sandbox.
 */

import { createFlutterwaveAdapter } from '@/services/flutterwave/adapter';
import { verifyWebhookSignature, parseWebhookEvent } from '@/services/flutterwave/webhook';
import type { FlutterwaveAdapter } from '@/services/flutterwave/types';

const HAS_FLW_KEY = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
const HAS_WEBHOOK_HASH = Boolean(process.env.FLUTTERWAVE_WEBHOOK_HASH);

const itLive = HAS_FLW_KEY ? it : it.skip;
const itWebhook = (HAS_FLW_KEY && HAS_WEBHOOK_HASH) ? it : it.skip;

// Flutterwave sandbox test account (from official Flutterwave docs)
const SANDBOX_ACCOUNT_NUMBER = '0690000031';
const SANDBOX_BANK_CODE = '044'; // Access Bank sandbox

describe('Flutterwave Integration Tests', () => {
  let adapter: FlutterwaveAdapter;

  beforeAll(() => {
    if (!HAS_FLW_KEY) return;
    adapter = createFlutterwaveAdapter({
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY!,
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Adapter creation
  // ---------------------------------------------------------------------------
  describe('createFlutterwaveAdapter', () => {
    it('throws when secretKey is missing', () => {
      expect(() => createFlutterwaveAdapter({ secretKey: '' })).toThrow(
        'FLUTTERWAVE_SECRET_KEY is required',
      );
    });

    itLive('creates adapter successfully with valid key', () => {
      expect(adapter).toBeDefined();
      expect(typeof adapter.verifyAccount).toBe('function');
      expect(typeof adapter.initiateTransfer).toBe('function');
      expect(typeof adapter.getTransferStatus).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Bank Account Verification
  // ---------------------------------------------------------------------------
  describe('verifyAccount — sandbox API', () => {
    itLive('resolves account name for valid sandbox account', async () => {
      const result = await adapter.verifyAccount({
        accountNumber: SANDBOX_ACCOUNT_NUMBER,
        bankCode: SANDBOX_BANK_CODE,
      });

      expect(result).toMatchObject({
        accountNumber: SANDBOX_ACCOUNT_NUMBER,
        bankCode: SANDBOX_BANK_CODE,
        accountName: expect.any(String),
      });
      expect(result.accountName.length).toBeGreaterThan(0);
    });

    itLive('throws FlutterwaveError for non-existent bank code', async () => {
      await expect(
        adapter.verifyAccount({
          accountNumber: SANDBOX_ACCOUNT_NUMBER,
          bankCode: '9999',
        }),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Transfer Initiation
  // ---------------------------------------------------------------------------
  describe('initiateTransfer — sandbox API', () => {
    itLive('initiates a NGN transfer to sandbox account', async () => {
      const reference = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const result = await adapter.initiateTransfer({
        accountNumber: SANDBOX_ACCOUNT_NUMBER,
        bankCode: SANDBOX_BANK_CODE,
        accountName: 'Test Recipient',
        amount: 100,
        narration: 'Integration test transfer',
        reference,
      });

      expect(result).toMatchObject({
        id: expect.any(String),
        reference,
        status: expect.stringMatching(/^(NEW|PENDING|SUCCESSFUL|FAILED)$/),
        amount: 100,
        currency: 'NGN',
        narration: 'Integration test transfer',
        createdAt: expect.any(String),
      });
    });

    itLive('is idempotent — same reference returns same transfer ID', async () => {
      const reference = `idem-${Date.now()}`;
      const payload = {
        accountNumber: SANDBOX_ACCOUNT_NUMBER,
        bankCode: SANDBOX_BANK_CODE,
        accountName: 'Test Recipient',
        amount: 100,
        narration: 'Idempotency test',
        reference,
      };

      const first = await adapter.initiateTransfer(payload);
      const second = await adapter.initiateTransfer(payload);

      expect(first.id).toEqual(second.id);
    });

    itLive('rejects transfer with amount of zero', async () => {
      await expect(
        adapter.initiateTransfer({
          accountNumber: SANDBOX_ACCOUNT_NUMBER,
          bankCode: SANDBOX_BANK_CODE,
          accountName: 'Test Recipient',
          amount: 0,
          narration: 'Zero amount test',
          reference: `zero-${Date.now()}`,
        }),
      ).rejects.toThrow();
    });

    itLive('rejects transfer with negative amount', async () => {
      await expect(
        adapter.initiateTransfer({
          accountNumber: SANDBOX_ACCOUNT_NUMBER,
          bankCode: SANDBOX_BANK_CODE,
          accountName: 'Test Recipient',
          amount: -500,
          narration: 'Negative amount test',
          reference: `neg-${Date.now()}`,
        }),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Transfer Status Polling
  // ---------------------------------------------------------------------------
  describe('getTransferStatus — sandbox API', () => {
    itLive('returns status for an existing transfer', async () => {
      const reference = `status-${Date.now()}`;
      const transfer = await adapter.initiateTransfer({
        accountNumber: SANDBOX_ACCOUNT_NUMBER,
        bankCode: SANDBOX_BANK_CODE,
        accountName: 'Test Recipient',
        amount: 100,
        narration: 'Status polling test',
        reference,
      });

      const status = await adapter.getTransferStatus(transfer.id);

      expect(status).toMatchObject({
        id: transfer.id,
        reference: transfer.reference,
        status: expect.stringMatching(/^(NEW|PENDING|SUCCESSFUL|FAILED)$/),
        amount: 100,
        currency: 'NGN',
      });
    });

    itLive('throws for a non-existent transfer ID', async () => {
      await expect(
        adapter.getTransferStatus('99999999'),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Webhook Signature Verification (pure function — no sandbox needed)
  // ---------------------------------------------------------------------------
  describe('verifyWebhookSignature', () => {
    const secretHash = 'test-webhook-secret-hash';

    it('returns true when verif-hash header matches secret hash exactly', () => {
      expect(verifyWebhookSignature(secretHash, secretHash)).toBe(true);
    });

    it('returns false when verif-hash header does not match', () => {
      expect(verifyWebhookSignature('wrong-value', secretHash)).toBe(false);
    });

    it('returns false when header value is empty', () => {
      expect(verifyWebhookSignature('', secretHash)).toBe(false);
    });

    it('returns false when secret hash is empty', () => {
      expect(verifyWebhookSignature(secretHash, '')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(verifyWebhookSignature('TEST-HASH', 'test-hash')).toBe(false);
    });

    itWebhook('validates real webhook hash from env against itself', () => {
      const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH!;
      expect(verifyWebhookSignature(hash, hash)).toBe(true);
    });

    itWebhook('rejects tampered hash value', () => {
      const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH!;
      expect(verifyWebhookSignature(`${hash}TAMPERED`, hash)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Webhook Payload Parsing (pure function — no sandbox needed)
  // ---------------------------------------------------------------------------
  describe('parseWebhookEvent', () => {
    const validPayload = {
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
      expect(result).toMatchObject({
        event: 'transfer.completed',
        data: expect.objectContaining({ tx_ref: 'ref-abc-001' }),
      });
    });

    it('throws on malformed JSON', () => {
      expect(() => parseWebhookEvent('not-json')).toThrow('Invalid webhook payload');
    });

    it('throws when event field is missing', () => {
      const bad = JSON.stringify({ data: validPayload.data });
      expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
    });

    it('throws when data field is missing', () => {
      const bad = JSON.stringify({ event: 'transfer.completed' });
      expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
    });

    it('throws when data.tx_ref is missing', () => {
      const bad = JSON.stringify({
        event: 'transfer.completed',
        data: { id: 1, status: 'SUCCESSFUL', amount: 100, currency: 'NGN' },
      });
      expect(() => parseWebhookEvent(bad)).toThrow('Invalid webhook payload');
    });
  });
});
