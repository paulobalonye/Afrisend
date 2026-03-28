// Shared KYC types used by both apps/mobile and apps/api

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
