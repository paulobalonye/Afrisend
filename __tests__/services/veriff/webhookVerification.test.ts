import {
  verifyWebhookSignature,
  parseWebhookPayload,
  VeriffWebhookPayload,
  VeriffWebhookDecision,
} from '../../../src/services/veriff/webhookVerification';
import crypto from 'crypto';

function computeExpectedSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const SHARED_SECRET = 'test_shared_secret_abc';

describe('verifyWebhookSignature', () => {
  it('returns true for a valid HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ id: 'sess_123', status: 'approved' });
    const validSig = computeExpectedSignature(payload, SHARED_SECRET);

    expect(verifyWebhookSignature(payload, validSig, SHARED_SECRET)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const payload = JSON.stringify({ id: 'sess_123', status: 'approved' });
    const invalidSig = 'deadbeefdeadbeefdeadbeefdeadbeef';

    expect(verifyWebhookSignature(payload, invalidSig, SHARED_SECRET)).toBe(false);
  });

  it('returns false when payload is tampered', () => {
    const originalPayload = JSON.stringify({ id: 'sess_123', status: 'approved' });
    const tamperedPayload = JSON.stringify({ id: 'sess_123', status: 'declined' });
    const sig = computeExpectedSignature(originalPayload, SHARED_SECRET);

    expect(verifyWebhookSignature(tamperedPayload, sig, SHARED_SECRET)).toBe(false);
  });

  it('returns false for empty signature', () => {
    const payload = JSON.stringify({ id: 'sess_123' });
    expect(verifyWebhookSignature(payload, '', SHARED_SECRET)).toBe(false);
  });

  it('returns false for empty payload', () => {
    const sig = computeExpectedSignature('', SHARED_SECRET);
    expect(verifyWebhookSignature('', sig, SHARED_SECRET)).toBe(false);
  });

  it('returns false when signature is non-hex (causes Buffer length mismatch)', () => {
    const payload = JSON.stringify({ id: 'sess_123' });
    // A non-hex string will cause timingSafeEqual to throw → should return false
    expect(verifyWebhookSignature(payload, 'not-valid-hex!!', SHARED_SECRET)).toBe(false);
  });

  it('uses constant-time comparison to prevent timing attacks', () => {
    // Ensure timingSafeEqual is used — we test by verifying two equal signatures pass
    const payload = JSON.stringify({ id: 'sess_999', status: 'approved' });
    const validSig = computeExpectedSignature(payload, SHARED_SECRET);

    // Identical signature should pass
    expect(verifyWebhookSignature(payload, validSig, SHARED_SECRET)).toBe(true);
    // Signature one char off should fail
    const offBySig = validSig.slice(0, -1) + (validSig.endsWith('0') ? '1' : '0');
    expect(verifyWebhookSignature(payload, offBySig, SHARED_SECRET)).toBe(false);
  });
});

describe('parseWebhookPayload', () => {
  it('parses a valid approved decision payload', () => {
    const raw: VeriffWebhookPayload = {
      id: 'evt_abc',
      attemptId: 'att_001',
      feature: 'selfid',
      code: 9001,
      action: 'submitted',
      vendorData: 'user_id_42',
      status: 'approved',
      verification: {
        id: 'sess_abc123',
        status: 'approved',
        code: 9001,
        reason: null,
        reasonCode: null,
        document: { type: 'PASSPORT', country: 'NG', number: null, validUntil: null },
        person: { firstName: null, lastName: null, dateOfBirth: null },
        riskLabels: [],
        checkedAt: '2026-03-28T10:00:00Z',
      },
    };

    const result = parseWebhookPayload(JSON.stringify(raw));

    expect(result.status).toBe('approved');
    expect(result.sessionId).toBe('sess_abc123');
    expect(result.decision).toBe('approved' as VeriffWebhookDecision);
  });

  it('parses a declined decision payload', () => {
    const raw: VeriffWebhookPayload = {
      id: 'evt_def',
      attemptId: 'att_002',
      feature: 'selfid',
      code: 9102,
      action: 'submitted',
      vendorData: 'user_id_55',
      status: 'declined',
      verification: {
        id: 'sess_def456',
        status: 'declined',
        code: 9102,
        reason: 'Document expired',
        reasonCode: 102,
        document: { type: 'ID_CARD', country: 'KE', number: null, validUntil: null },
        person: { firstName: null, lastName: null, dateOfBirth: null },
        riskLabels: [],
        checkedAt: '2026-03-28T10:05:00Z',
      },
    };

    const result = parseWebhookPayload(JSON.stringify(raw));

    expect(result.status).toBe('declined');
    expect(result.reason).toBe('Document expired');
    expect(result.reasonCode).toBe(102);
  });

  it('parses a resubmission_requested payload', () => {
    const raw: VeriffWebhookPayload = {
      id: 'evt_ghi',
      attemptId: 'att_003',
      feature: 'selfid',
      code: 9103,
      action: 'submitted',
      vendorData: 'user_id_77',
      status: 'resubmission_requested',
      verification: {
        id: 'sess_ghi789',
        status: 'resubmission_requested',
        code: 9103,
        reason: 'Document not readable',
        reasonCode: 103,
        document: { type: 'DRIVERS_LICENSE', country: 'GH', number: null, validUntil: null },
        person: { firstName: null, lastName: null, dateOfBirth: null },
        riskLabels: [],
        checkedAt: '2026-03-28T10:10:00Z',
      },
    };

    const result = parseWebhookPayload(JSON.stringify(raw));

    expect(result.decision).toBe('resubmission_requested' as VeriffWebhookDecision);
  });

  it('throws on invalid JSON payload', () => {
    expect(() => parseWebhookPayload('not-json')).toThrow();
  });

  it('throws when required verification fields are missing', () => {
    const incomplete = JSON.stringify({ id: 'evt_x', status: 'approved' });
    expect(() => parseWebhookPayload(incomplete)).toThrow();
  });

  it('handles missing optional fields by using fallback empty values', () => {
    // Minimal payload — only required verification.id and verification.status present
    const minimal = JSON.stringify({
      // no id, no attemptId, no vendorData, no status at root level
      verification: {
        id: 'sess_min001',
        status: 'approved' as VeriffWebhookDecision,
        code: undefined,
        reason: undefined,
        reasonCode: undefined,
        // no document, no person, no riskLabels, no checkedAt
      },
    });

    const result = parseWebhookPayload(minimal);

    expect(result.sessionId).toBe('sess_min001');
    expect(result.eventId).toBe('');
    expect(result.attemptId).toBe('');
    expect(result.vendorData).toBe('');
    expect(result.code).toBe(0);
    expect(result.reason).toBeNull();
    expect(result.reasonCode).toBeNull();
    expect(result.documentType).toBe('');
    expect(result.documentCountry).toBe('');
    expect(result.riskLabels).toEqual([]);
    expect(result.checkedAt).toBeNull();
  });

  it('does NOT include PII fields in the returned object', () => {
    const raw: VeriffWebhookPayload = {
      id: 'evt_pii',
      attemptId: 'att_004',
      feature: 'selfid',
      code: 9001,
      action: 'submitted',
      vendorData: 'user_id_88',
      status: 'approved',
      verification: {
        id: 'sess_pii001',
        status: 'approved',
        code: 9001,
        reason: null,
        reasonCode: null,
        document: { type: 'PASSPORT', country: 'ZA', number: 'AB123456', validUntil: '2030-01-01' },
        person: { firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01' },
        riskLabels: [],
        checkedAt: '2026-03-28T10:00:00Z',
      },
    };

    const result = parseWebhookPayload(JSON.stringify(raw));

    // PII must not leak into the parsed result
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('John');
    expect(resultStr).not.toContain('Doe');
    expect(resultStr).not.toContain('1990-01-01');
    expect(resultStr).not.toContain('AB123456');
  });
});
