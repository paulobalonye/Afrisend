/**
 * Veriff webhook verification utilities — SERVER-SIDE USE ONLY.
 *
 * IMPORTANT: This module uses Node.js `crypto` and is intended to run on the
 * backend (e.g. an Express/Fastify endpoint). Do NOT import in mobile app code.
 *
 * VERIFF_SHARED_SECRET must be provided from environment variables only.
 * PII (person names, document numbers, DOB) is deliberately stripped from
 * the parsed result to prevent accidental logging.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VeriffWebhookDecision =
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'review'
  | 'expired'
  | 'abandoned';

/** Raw shape of the Veriff webhook payload (as received over HTTP). */
export type VeriffWebhookPayload = {
  id: string;
  attemptId: string;
  feature: string;
  code: number;
  action: string;
  vendorData: string;
  status: VeriffWebhookDecision;
  verification: {
    id: string;
    status: VeriffWebhookDecision;
    code: number;
    reason: string | null;
    reasonCode: number | null;
    /** Document fields — may contain PII (number, validUntil). Stripped on parse. */
    document: {
      type: string;
      country: string;
      number: string | null;
      validUntil: string | null;
    };
    /** Person fields — PII. Stripped on parse. */
    person: {
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: string | null;
    };
    riskLabels: string[];
    checkedAt: string | null;
  };
};

/**
 * Sanitised webhook event — no PII fields.
 * Safe to pass to application logic and audit logs.
 */
export type VeriffWebhookEvent = {
  eventId: string;
  attemptId: string;
  sessionId: string;
  vendorData: string;
  decision: VeriffWebhookDecision;
  status: VeriffWebhookDecision;
  code: number;
  reason: string | null;
  reasonCode: number | null;
  documentType: string;
  documentCountry: string;
  riskLabels: string[];
  checkedAt: string | null;
};

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Veriff webhook HMAC-SHA256 signature using constant-time comparison.
 *
 * @param rawPayload  The raw request body string (before any JSON.parse).
 * @param signature   The value of the `x-hmac-signature` header.
 * @param sharedSecret  Value of VERIFF_SHARED_SECRET env var.
 * @returns true if the signature is valid; false otherwise.
 */
export function verifyWebhookSignature(
  rawPayload: string,
  signature: string,
  sharedSecret: string,
): boolean {
  if (!rawPayload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', sharedSecret)
    .update(rawPayload)
    .digest('hex');

  try {
    // timingSafeEqual prevents timing-based side-channel attacks
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    // Buffer lengths differ or invalid hex — treat as invalid
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payload parsing — strips PII
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw Veriff webhook JSON body.
 * Strips all PII fields before returning so the result is safe to log.
 *
 * @throws {Error} if the payload is invalid JSON or missing required fields.
 */
export function parseWebhookPayload(rawPayload: string): VeriffWebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error('Veriff webhook: invalid JSON payload');
  }

  const payload = parsed as Partial<VeriffWebhookPayload>;
  const verification = payload.verification;

  if (!verification?.id || !verification.status) {
    throw new Error('Veriff webhook: missing required verification fields');
  }

  // Return sanitised event — deliberately omit person.* and document.number / validUntil
  return {
    eventId: payload.id ?? '',
    attemptId: payload.attemptId ?? '',
    sessionId: verification.id,
    vendorData: payload.vendorData ?? '',
    decision: verification.status,
    status: payload.status ?? verification.status,
    code: verification.code ?? 0,
    reason: verification.reason ?? null,
    reasonCode: verification.reasonCode ?? null,
    documentType: verification.document?.type ?? '',
    documentCountry: verification.document?.country ?? '',
    riskLabels: verification.riskLabels ?? [],
    checkedAt: verification.checkedAt ?? null,
  };
}
