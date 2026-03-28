/**
 * Veriff Integration Tests
 *
 * The Veriff session creation and decision polling in this codebase flow through
 * the AfriSend backend (src/services/veriff/veriffAdapter.ts → /kyc/veriff/*).
 * Direct Veriff sandbox calls are not made from the mobile app layer.
 *
 * These tests cover:
 *   - Webhook HMAC signature verification (server-side utility, no network)
 *   - parseWebhookPayload — PII stripping and field validation
 *   - Document type configuration per jurisdiction
 *
 * PII-safety is a hard requirement (see HIT-37): no PII must appear
 * in logs, errors, or parsed webhook events.
 */

import crypto from 'crypto';
import {
  verifyWebhookSignature,
  parseWebhookPayload,
} from '@/services/veriff/webhookVerification';
import {
  getSupportedDocumentTypes,
  getDefaultDocumentType,
  isDocumentTypeSupported,
} from '@/services/veriff/documentTypes';

const SHARED_SECRET =
  process.env.VERIFF_SHARED_SECRET ?? 'test-veriff-shared-secret-xyz';

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function buildWebhookPayload(override: Record<string, unknown> = {}): string {
  const base = {
    id: `evt-${Date.now()}`,
    attemptId: `att-${Date.now()}`,
    feature: 'selfid',
    code: 9001,
    action: 'submitted',
    vendorData: 'user-vendor-ref-123',
    status: 'approved',
    verification: {
      id: `ver-${Date.now()}`,
      status: 'approved',
      code: 9001,
      reason: null,
      reasonCode: null,
      document: {
        type: 'PASSPORT',
        country: 'NG',
        number: 'A12345678', // PII — must be stripped in output
        validUntil: '2030-01-01', // PII — must be stripped
      },
      person: {
        firstName: 'John', // PII — must be stripped
        lastName: 'Doe', // PII — must be stripped
        dateOfBirth: '1990-01-01', // PII — must be stripped
      },
      riskLabels: [],
      checkedAt: '2026-03-28T10:00:00Z',
    },
  };
  return JSON.stringify({ ...base, ...override });
}

// ---------------------------------------------------------------------------
// 1. Webhook Signature Verification
// ---------------------------------------------------------------------------
describe('Veriff — Webhook Signature Verification', () => {
  const payload = buildWebhookPayload();

  it('verifies a correctly signed webhook payload', () => {
    const sig = sign(payload, SHARED_SECRET);
    expect(verifyWebhookSignature(payload, sig, SHARED_SECRET)).toBe(true);
  });

  it('rejects payload with wrong signature', () => {
    expect(verifyWebhookSignature(payload, 'badsignature', SHARED_SECRET)).toBe(false);
  });

  it('rejects tampered payload (signature from original)', () => {
    const sig = sign(payload, SHARED_SECRET);
    const tampered = buildWebhookPayload({ code: 9102, status: 'declined' });
    expect(verifyWebhookSignature(tampered, sig, SHARED_SECRET)).toBe(false);
  });

  it('returns false when payload is empty', () => {
    expect(verifyWebhookSignature('', sign('', SHARED_SECRET), SHARED_SECRET)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    expect(verifyWebhookSignature(payload, '', SHARED_SECRET)).toBe(false);
  });

  it('handles short hex signature without throwing', () => {
    expect(verifyWebhookSignature(payload, 'abc', SHARED_SECRET)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Webhook Payload Parsing — PII Stripping
// ---------------------------------------------------------------------------
describe('Veriff — parseWebhookPayload (PII stripping)', () => {
  it('parses a valid approved webhook event', () => {
    const payload = buildWebhookPayload();
    const event = parseWebhookPayload(payload);

    expect(event).toMatchObject({
      eventId: expect.any(String),
      attemptId: expect.any(String),
      sessionId: expect.any(String),
      vendorData: 'user-vendor-ref-123',
      decision: 'approved',
      status: 'approved',
      code: 9001,
      reason: null,
      reasonCode: null,
      documentType: 'PASSPORT',
      documentCountry: 'NG',
      riskLabels: [],
      checkedAt: '2026-03-28T10:00:00Z',
    });
  });

  it('strips PII — person fields not present in parsed output', () => {
    const payload = buildWebhookPayload();
    const event = parseWebhookPayload(payload);
    const serialised = JSON.stringify(event);

    expect(serialised).not.toContain('John');
    expect(serialised).not.toContain('Doe');
    expect(serialised).not.toContain('1990-01-01');
  });

  it('strips PII — document number and expiry not present in parsed output', () => {
    const payload = buildWebhookPayload();
    const event = parseWebhookPayload(payload);
    const serialised = JSON.stringify(event);

    expect(serialised).not.toContain('A12345678');
    expect(serialised).not.toContain('2030-01-01');
  });

  it('parses a declined webhook event with risk labels', () => {
    const payload = JSON.stringify({
      id: 'evt-declined',
      attemptId: 'att-declined',
      feature: 'selfid',
      code: 9102,
      action: 'submitted',
      vendorData: 'user-ref-declined',
      status: 'declined',
      verification: {
        id: 'ver-declined',
        status: 'declined',
        code: 9102,
        reason: 'Document expired',
        reasonCode: 102,
        document: { type: 'ID_CARD', country: 'GH', number: null, validUntil: null },
        person: { firstName: 'Jane', lastName: 'Smith', dateOfBirth: null },
        riskLabels: ['expired_document'],
        checkedAt: '2026-03-28T11:00:00Z',
      },
    });

    const event = parseWebhookPayload(payload);

    expect(event.decision).toBe('declined');
    expect(event.code).toBe(9102);
    expect(event.reason).toBe('Document expired');
    expect(event.reasonCode).toBe(102);
    expect(event.riskLabels).toContain('expired_document');
    expect(JSON.stringify(event)).not.toContain('Jane');
    expect(JSON.stringify(event)).not.toContain('Smith');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseWebhookPayload('not-json')).toThrow();
  });

  it('throws when verification.id is missing', () => {
    const bad = JSON.stringify({
      id: 'evt-1',
      verification: { status: 'approved' },
    });
    expect(() => parseWebhookPayload(bad)).toThrow();
  });

  it('throws when verification.status is missing', () => {
    const bad = JSON.stringify({
      id: 'evt-1',
      verification: { id: 'ver-1' },
    });
    expect(() => parseWebhookPayload(bad)).toThrow();
  });

  it('does not expose PII in thrown error messages', () => {
    const badPayload = JSON.stringify({
      person: { firstName: 'John', ssn: '123-45-6789' },
    });

    let errorMessage = '';
    try {
      parseWebhookPayload(badPayload);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    expect(errorMessage).not.toContain('John');
    expect(errorMessage).not.toContain('123-45-6789');
  });
});

// ---------------------------------------------------------------------------
// 3. Document Type Configuration Per Jurisdiction
// ---------------------------------------------------------------------------
describe('Veriff — document type configuration', () => {
  describe('getSupportedDocumentTypes', () => {
    it('returns passport for Nigeria', () => {
      const types = getSupportedDocumentTypes('NG');
      expect(types).toContain('passport');
    });

    it('returns national_id for Nigeria', () => {
      const types = getSupportedDocumentTypes('NG');
      expect(types).toContain('national_id');
    });

    it('returns passport as the first (preferred) type for Nigeria', () => {
      const types = getSupportedDocumentTypes('NG');
      expect(types[0]).toBe('passport');
    });

    it('is case-insensitive for country codes', () => {
      const upper = getSupportedDocumentTypes('NG');
      const lower = getSupportedDocumentTypes('ng');
      expect(upper).toEqual(lower);
    });

    it('falls back to DEFAULT for unknown country codes', () => {
      const types = getSupportedDocumentTypes('XX');
      expect(types).toContain('passport');
      expect(types.length).toBeGreaterThan(0);
    });

    it('returns passport for all supported African countries', () => {
      ['NG', 'GH', 'KE', 'TZ', 'UG', 'ZA', 'EG', 'MA'].forEach((cc) => {
        expect(getSupportedDocumentTypes(cc)).toContain('passport');
      });
    });
  });

  describe('getDefaultDocumentType', () => {
    it('returns passport as default for Nigeria', () => {
      expect(getDefaultDocumentType('NG')).toBe('passport');
    });

    it('returns a string for any country code', () => {
      expect(typeof getDefaultDocumentType('XX')).toBe('string');
    });
  });

  describe('isDocumentTypeSupported', () => {
    it('returns true for passport in Nigeria', () => {
      expect(isDocumentTypeSupported('passport', 'NG')).toBe(true);
    });

    it('returns true for national_id in Nigeria', () => {
      expect(isDocumentTypeSupported('national_id', 'NG')).toBe(true);
    });

    it('returns true for passport in unknown country (fallback)', () => {
      expect(isDocumentTypeSupported('passport', 'XX')).toBe(true);
    });

    it('returns false for residence_permit in Nigeria', () => {
      // NG doesn't list residence_permit in its types
      expect(isDocumentTypeSupported('residence_permit', 'NG')).toBe(false);
    });
  });
});
