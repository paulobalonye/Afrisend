/**
 * KYC service interface + default sandbox implementation.
 *
 * In production: wire up the Veriff API adapter directly.
 */

import type { KycSession, KycDocument, DocumentType } from '@afrisend/shared';
import type { LivenessCheckToken } from '@afrisend/shared';

export type VeriffSessionResult = {
  sessionId: string;
  sessionUrl: string;
  vendorData: string;
  status: 'created';
};

export type VeriffDecisionResult = {
  sessionId: string;
  status: string;
  code: number;
  reason: string | null;
  reasonCode: number | null;
  checkedAt: string | null;
};

export type WebhookResult = {
  received: boolean;
};

export interface IKycService {
  createSession(userId?: string): Promise<KycSession>;
  getSession(userId?: string): Promise<KycSession>;
  uploadDocument(sessionId: string, fileBuffer: Buffer, documentType: DocumentType, side: 'front' | 'back'): Promise<KycDocument>;
  uploadSelfie(sessionId: string, fileBuffer: Buffer): Promise<KycDocument>;
  uploadAddressProof(sessionId: string, fileBuffer: Buffer, mimeType: string): Promise<KycDocument>;
  getLivenessToken(sessionId: string): Promise<LivenessCheckToken>;
  submitSession(sessionId: string): Promise<KycSession>;
  createVeriffSession(config: { vendorData: string; countryCode: string; documentType?: string }): Promise<VeriffSessionResult>;
  getVeriffDecision(sessionId: string): Promise<VeriffDecisionResult>;
  handleVeriffWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class DefaultKycService implements IKycService {
  async createSession(_userId?: string): Promise<KycSession> {
    return {
      sessionId: generateId('kyc'),
      status: 'pending',
      tier: 1,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getSession(_userId?: string): Promise<KycSession> {
    return {
      sessionId: generateId('kyc'),
      status: 'pending',
      tier: 1,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async uploadDocument(sessionId: string, _fileBuffer: Buffer, documentType: DocumentType, side: 'front' | 'back'): Promise<KycDocument> {
    return {
      id: generateId('doc'),
      type: documentType,
      side,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    };
  }

  async uploadSelfie(sessionId: string, _fileBuffer: Buffer): Promise<KycDocument> {
    return {
      id: generateId('doc'),
      type: 'passport',
      side: 'front',
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    };
  }

  async uploadAddressProof(sessionId: string, _fileBuffer: Buffer, _mimeType: string): Promise<KycDocument> {
    return {
      id: generateId('doc'),
      type: 'passport',
      side: 'front',
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    };
  }

  async getLivenessToken(sessionId: string): Promise<LivenessCheckToken> {
    return {
      token: generateId('liveness'),
      provider: 'onfido',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async submitSession(sessionId: string): Promise<KycSession> {
    return {
      sessionId,
      status: 'processing',
      tier: 1,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createVeriffSession(config: { vendorData: string; countryCode: string; documentType?: string }): Promise<VeriffSessionResult> {
    const sessionId = generateId('veriff');
    return {
      sessionId,
      sessionUrl: `https://alchemy.veriff.com/v/sandbox/${sessionId}`,
      vendorData: config.vendorData,
      status: 'created',
    };
  }

  async getVeriffDecision(sessionId: string): Promise<VeriffDecisionResult> {
    return {
      sessionId,
      status: 'approved',
      code: 9001,
      reason: null,
      reasonCode: null,
      checkedAt: new Date().toISOString(),
    };
  }

  async handleVeriffWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    return { received: true };
  }
}
