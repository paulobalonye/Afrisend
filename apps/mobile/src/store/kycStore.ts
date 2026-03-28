import { create } from 'zustand';
import type { KycSession, KycDocument, DocumentType } from '@/api/endpoints/kyc';

export type KycStep = 'intro' | 'id_upload' | 'selfie' | 'address' | 'review' | 'status';

type CapturedDocument = {
  uri: string;
  documentType: DocumentType;
  side: 'front' | 'back';
};

type KycState = {
  currentStep: KycStep;
  session: KycSession | null;
  capturedIdFront: CapturedDocument | null;
  capturedIdBack: CapturedDocument | null;
  capturedSelfie: string | null;
  capturedAddressDoc: string | null;
  selectedDocumentType: DocumentType | null;
  isLoading: boolean;
  error: string | null;
  uploadedDocuments: KycDocument[];
};

type KycActions = {
  setCurrentStep: (step: KycStep) => void;
  setSession: (session: KycSession) => void;
  setCapturedIdFront: (doc: CapturedDocument) => void;
  setCapturedIdBack: (doc: CapturedDocument) => void;
  setCapturedSelfie: (uri: string) => void;
  setCapturedAddressDoc: (uri: string) => void;
  setSelectedDocumentType: (type: DocumentType) => void;
  addUploadedDocument: (doc: KycDocument) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

const initialState: KycState = {
  currentStep: 'intro',
  session: null,
  capturedIdFront: null,
  capturedIdBack: null,
  capturedSelfie: null,
  capturedAddressDoc: null,
  selectedDocumentType: null,
  isLoading: false,
  error: null,
  uploadedDocuments: [],
};

export const useKycStore = create<KycState & KycActions>((set) => ({
  ...initialState,

  setCurrentStep: (currentStep) => set({ currentStep }),

  setSession: (session) => set({ session }),

  setCapturedIdFront: (capturedIdFront) => set({ capturedIdFront }),

  setCapturedIdBack: (capturedIdBack) => set({ capturedIdBack }),

  setCapturedSelfie: (capturedSelfie) => set({ capturedSelfie }),

  setCapturedAddressDoc: (capturedAddressDoc) => set({ capturedAddressDoc }),

  setSelectedDocumentType: (selectedDocumentType) => set({ selectedDocumentType }),

  addUploadedDocument: (doc) =>
    set((state) => ({
      uploadedDocuments: [...state.uploadedDocuments, doc],
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState }),
}));

// Derived selectors
export function selectKycProgress(state: KycState): number {
  const steps: KycStep[] = ['intro', 'id_upload', 'selfie', 'address', 'review', 'status'];
  const index = steps.indexOf(state.currentStep);
  return index / (steps.length - 1);
}

export function selectIsIdUploadComplete(state: KycState): boolean {
  if (!state.capturedIdFront) return false;
  if (state.selectedDocumentType !== 'passport' && !state.capturedIdBack) return false;
  return true;
}
