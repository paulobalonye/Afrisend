/**
 * SmileIdentityKycService
 *
 * In-process KYC service that uses a SmileIdentityAdapter for all external
 * calls. State is held in-memory for the sandbox; swap in a DB-backed
 * implementation for production.
 *
 * Verification tiers (per compliance framework):
 *   Tier 0: email + phone only  — $0 send limit
 *   Tier 1: national ID / passport scan — $500/month
 *   Tier 2: selfie + liveness check — $3,000/month
 *   Tier 3: full EDD — unlimited
 */

import type { SmileIdentityAdapter, DocumentType } from '../adapters/smileIdentityAdapter';

// ─── Public types ─────────────────────────────────────────────────────────────

export type KycSubmissionStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'more_info_needed';

export type KycSubmission = {
  id: string;
  userId: string;
  tier: number;
  provider: 'smile_identity';
  providerReference: string | null;
  status: KycSubmissionStatus;
  rejectionReason: string | null;
  submittedAt: string;
  verifiedAt: string | null;
};

export type KycStatusResult = {
  userId: string;
  currentTier: number;
  status: KycSubmissionStatus | 'none';
  latestSubmission: KycSubmission | null;
};

// ─── Internal state ───────────────────────────────────────────────────────────

type SubmissionRecord = KycSubmission & { _internal_userId: string };

// ─── Service ──────────────────────────────────────────────────────────────────

export class SmileIdentityKycService {
  private readonly adapter: SmileIdentityAdapter;

  // In-memory store: submissionId → record.  Production replaces with DB.
  private readonly submissions = new Map<string, SubmissionRecord>();

  // userId → current approved tier
  private readonly userTiers = new Map<string, number>();

  constructor(adapter: SmileIdentityAdapter) {
    this.adapter = adapter;
  }

  // ── submitKyc ─────────────────────────────────────────────────────────────

  async submitKyc(
    userId: string,
    tier: number,
    documentType: DocumentType,
    imageBuffer: Buffer,
  ): Promise<KycSubmission> {
    const imageBase64 = imageBuffer.toString('base64');

    const adapterResponse = await this.adapter.submitJob({
      userId,
      tier,
      documentType,
      imageBase64,
    });

    const submission: SubmissionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      tier,
      provider: 'smile_identity',
      providerReference: adapterResponse.smileJobId,
      status: 'pending',
      rejectionReason: null,
      submittedAt: new Date().toISOString(),
      verifiedAt: null,
      _internal_userId: userId,
    };

    this.submissions.set(submission.id, submission);

    return this.toPublic(submission);
  }

  // ── getKycStatus ──────────────────────────────────────────────────────────

  async getKycStatus(userId: string): Promise<KycStatusResult> {
    const userSubmissions = [...this.submissions.values()]
      .filter((s) => s._internal_userId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const latest = userSubmissions[0] ?? null;
    const currentTier = this.userTiers.get(userId) ?? 0;

    return {
      userId,
      currentTier,
      status: latest ? latest.status : 'none',
      latestSubmission: latest ? this.toPublic(latest) : null,
    };
  }

  // ── handleSmileWebhook ────────────────────────────────────────────────────

  async handleSmileWebhook(
    payload: unknown,
    signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

    if (!this.adapter.verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const data = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    const smileJobId = data['SmileJobID'] as string | undefined;
    const resultCode = (data['ResultCode'] as string | undefined) ?? '';
    const actions = (data['Actions'] as Record<string, string> | undefined) ?? {};

    if (!smileJobId) return { received: true };

    // Find the matching submission by providerReference
    const submission = [...this.submissions.values()].find(
      (s) => s.providerReference === smileJobId,
    );

    if (!submission) return { received: true }; // unknown job — ACK and ignore

    // Idempotency: skip if already in a terminal state
    if (submission.status === 'approved' || submission.status === 'rejected') {
      return { received: true };
    }

    const isApproved = this.isApprovalCode(resultCode);

    if (isApproved) {
      const updatedSubmission: SubmissionRecord = {
        ...submission,
        status: 'approved',
        verifiedAt: new Date().toISOString(),
      };
      this.submissions.set(submission.id, updatedSubmission);

      // Upgrade tier — determine tier from the actions in the webhook
      const hasLiveness = actions['Liveness_Check'] === 'Passed';
      const approvedTier = hasLiveness ? 2 : submission.tier;

      const currentTier = this.userTiers.get(submission._internal_userId) ?? 0;
      if (approvedTier > currentTier) {
        this.userTiers.set(submission._internal_userId, approvedTier);
      }
    } else {
      const updatedSubmission: SubmissionRecord = {
        ...submission,
        status: 'rejected',
        rejectionReason: data['ResultText'] as string ?? 'Verification failed',
      };
      this.submissions.set(submission.id, updatedSubmission);
    }

    return { received: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private toPublic(record: SubmissionRecord): KycSubmission {
    return {
      id: record.id,
      userId: record.userId,
      tier: record.tier,
      provider: record.provider,
      providerReference: record.providerReference,
      status: record.status,
      rejectionReason: record.rejectionReason,
      submittedAt: record.submittedAt,
      verifiedAt: record.verifiedAt,
    };
  }

  /**
   * Smile Identity result codes: 0810 = pass, 0820 = fail (simplified).
   * Full codes: https://docs.usesmileid.com/further-reading/smile-results-codes
   */
  private isApprovalCode(resultCode: string): boolean {
    const APPROVAL_CODES = new Set(['0810', '0811', '0812']);
    return APPROVAL_CODES.has(resultCode);
  }
}
