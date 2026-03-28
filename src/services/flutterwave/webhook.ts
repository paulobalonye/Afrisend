import type { WebhookEvent } from './types';

/**
 * Verifies a Flutterwave webhook request by comparing the verif-hash header
 * value against the configured secret hash. Both values must be non-empty and equal.
 */
export function verifyWebhookSignature(headerValue: string, secretHash: string): boolean {
  if (!headerValue || !secretHash) {
    return false;
  }
  return headerValue === secretHash;
}

/**
 * Parses and validates a raw Flutterwave webhook JSON body.
 * Throws with 'Invalid webhook payload' on malformed JSON or missing required fields.
 */
export function parseWebhookEvent(rawBody: string): WebhookEvent {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid webhook payload');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('event' in parsed) ||
    typeof (parsed as Record<string, unknown>).event !== 'string' ||
    !('data' in parsed) ||
    typeof (parsed as Record<string, unknown>).data !== 'object' ||
    (parsed as Record<string, unknown>).data === null
  ) {
    throw new Error('Invalid webhook payload');
  }

  const data = (parsed as { event: string; data: Record<string, unknown> }).data;

  if (!('tx_ref' in data) || typeof data.tx_ref !== 'string') {
    throw new Error('Invalid webhook payload');
  }

  return parsed as WebhookEvent;
}
