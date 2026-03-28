/**
 * YellowCard webhook verification utilities — SERVER-SIDE USE ONLY.
 *
 * IMPORTANT: This module uses Node.js `crypto` and is intended to run on the
 * backend (e.g. an Express/Fastify endpoint). Do NOT import in mobile app code.
 *
 * YELLOWCARD_WEBHOOK_SECRET must be provided from environment variables only.
 * Never hardcode secrets in source code.
 */

import crypto from 'crypto';

/**
 * Verify a YellowCard webhook HMAC-SHA256 signature using constant-time comparison.
 *
 * @param rawPayload   The raw request body string (before any JSON.parse).
 * @param signature    The HMAC-SHA256 signature from the webhook request header.
 * @param webhookSecret  Value of YELLOWCARD_WEBHOOK_SECRET env var.
 * @returns true if the signature is valid; false otherwise.
 */
export function verifyWebhookSignature(
  rawPayload: string,
  signature: string,
  webhookSecret: string,
): boolean {
  if (!rawPayload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
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
