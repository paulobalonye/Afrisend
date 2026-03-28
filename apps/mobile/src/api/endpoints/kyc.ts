import { post, get, uploadFile } from '../client';

export type DocumentType = 'passport' | 'national_id' | 'driver_license';

export type KycDocument = {
  id: string;
  type: DocumentType;
  side: 'front' | 'back';
  status: 'pending' | 'processing' | 'accepted' | 'rejected';
  uploadedAt: string;
};

export type KycSession = {
  sessionId: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'more_info_needed';
  tier: 1 | 2 | 3;
  documents: KycDocument[];
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
};

export type LivenessCheckToken = {
  token: string;
  provider: 'smile_identity' | 'onfido' | 'sumsub';
  expiresAt: string;
};

export async function startKycSession(): Promise<KycSession> {
  return post<KycSession>('/kyc/sessions');
}

export async function getKycStatus(): Promise<KycSession> {
  return get<KycSession>('/kyc/sessions/current');
}

export async function uploadIdDocument(
  sessionId: string,
  fileUri: string,
  documentType: DocumentType,
  side: 'front' | 'back',
): Promise<KycDocument> {
  return uploadFile<KycDocument>(
    `/kyc/sessions/${sessionId}/documents`,
    fileUri,
    'document',
    'image/jpeg',
    { documentType, side },
  );
}

export async function uploadSelfie(sessionId: string, fileUri: string): Promise<KycDocument> {
  return uploadFile<KycDocument>(
    `/kyc/sessions/${sessionId}/selfie`,
    fileUri,
    'selfie',
    'image/jpeg',
  );
}

export async function uploadProofOfAddress(
  sessionId: string,
  fileUri: string,
  mimeType: string,
): Promise<KycDocument> {
  return uploadFile<KycDocument>(
    `/kyc/sessions/${sessionId}/address`,
    fileUri,
    'document',
    mimeType,
  );
}

export async function getLivenessToken(sessionId: string): Promise<LivenessCheckToken> {
  return post<LivenessCheckToken>(`/kyc/sessions/${sessionId}/liveness-token`);
}

export async function submitKycSession(sessionId: string): Promise<KycSession> {
  return post<KycSession>(`/kyc/sessions/${sessionId}/submit`);
}
