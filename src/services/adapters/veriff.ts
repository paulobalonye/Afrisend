/**
 * Veriff adapter interface — KYC identity verification.
 *
 * All secrets sourced from env vars:
 *   VERIFF_API_KEY
 *   VERIFF_SHARED_SECRET
 *
 * CRITICAL: PII from KYC data must NEVER appear in application logs.
 * Only session IDs, timestamps, and non-PII status codes are logged.
 */

export type VeriffSessionConfig = {
  person: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
  };
  document?: {
    type?: 'PASSPORT' | 'ID_CARD' | 'DRIVERS_LICENSE' | 'RESIDENCE_PERMIT';
    country?: string;
  };
  vendorData?: string;
  timestamp: string;
};

export type VeriffSession = {
  sessionId: string;
  url: string;
  host: string;
  status: 'created';
  createdAt: string;
};

export type VeriffDecision =
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'expired'
  | 'abandoned'
  | 'review';

export type VeriffSessionDecision = {
  sessionId: string;
  status: 'created' | 'started' | 'submitted' | 'complete';
  decision: VeriffDecision | null;
  decisionTime?: string;
  acceptanceTime?: string;
  reasonCode?: number;
  reason?: string;
};

export type VeriffWebhookEvent = {
  id: string;
  attemptId: string;
  feature: string;
  code: number;
  action: 'submitted' | 'started';
  vendorData?: string;
  verificationId: string;
  decision?: {
    status: VeriffDecision;
    reason?: string;
    reasonCode?: number;
  };
};

export interface IVeriffAdapter {
  /**
   * Create a new Veriff verification session. Returns a URL for the end-user to
   * complete identity verification via the Veriff SDK or redirect flow.
   */
  createSession(config: VeriffSessionConfig): Promise<VeriffSession>;

  /**
   * Poll for the decision of a specific session.
   * Use when webhook delivery cannot be guaranteed.
   */
  getSessionDecision(sessionId: string): Promise<VeriffSessionDecision>;

  /**
   * Parse and validate an inbound Veriff webhook payload.
   * Verifies the X-HMAC-SIGNATURE header against VERIFF_SHARED_SECRET.
   * Returns the parsed event if valid, throws if signature is invalid.
   */
  handleWebhook(rawBody: string, signature: string): VeriffWebhookEvent;
}
