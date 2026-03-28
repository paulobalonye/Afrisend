/**
 * Veriff KYC adapter — mobile client side.
 *
 * Calls the AfriSend backend which in turn communicates with the Veriff API.
 * No Veriff API keys are held here; all secrets live on the backend.
 *
 * Interface:
 *   createSession(config)      → create a Veriff session; returns URL + sessionId
 *   getSessionDecision(id)     → poll backend for the verification decision
 */

import { post, get } from '../../api/client';
import { VeriffDocumentType } from './documentTypes';

export type VeriffSessionStatus =
  | 'created'
  | 'started'
  | 'submitted'
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'abandoned'
  | 'expired';

export type VeriffDecisionStatus =
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'review'
  | 'expired'
  | 'abandoned';

export type CreateSessionConfig = {
  /** Opaque reference to associate with this session (e.g. internal user ID). Not PII. */
  vendorData: string;
  /** ISO 3166-1 alpha-2 country code for document jurisdiction. */
  countryCode: string;
  /** Document type to present first in the Veriff flow. Defaults to 'passport'. */
  documentType?: VeriffDocumentType;
};

export type VeriffSession = {
  sessionId: string;
  /** URL to open in a WebView or browser to start the Veriff verification flow. */
  sessionUrl: string;
  vendorData: string;
  status: VeriffSessionStatus;
};

export type VeriffDecision = {
  sessionId: string;
  status: VeriffDecisionStatus;
  /** Veriff status code (e.g. 9001 = approved, 9102 = declined). */
  code: number;
  /** Human-readable decline / resubmission reason. Null on approval. */
  reason: string | null;
  /** Numeric reason code for programmatic handling. */
  reasonCode: number | null;
  /** ISO 8601 timestamp when the decision was made. Null while still in review. */
  checkedAt: string | null;
};

/**
 * Create a new Veriff verification session.
 * The backend creates the session with Veriff and returns the session URL.
 */
export async function createVeriffSession(config: CreateSessionConfig): Promise<VeriffSession> {
  const { vendorData, countryCode, documentType = 'passport' } = config;
  return post<VeriffSession>('/kyc/veriff/sessions', {
    vendorData,
    documentType,
    countryCode,
  });
}

/**
 * Fetch the current verification decision for a session.
 * Returns the latest decision status from the backend.
 * Use for polling when real-time webhook delivery is unavailable.
 */
export async function getSessionDecision(sessionId: string): Promise<VeriffDecision> {
  return get<VeriffDecision>(`/kyc/veriff/sessions/${sessionId}/decision`);
}
