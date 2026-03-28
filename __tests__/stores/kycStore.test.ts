import { renderHook, act } from '@testing-library/react-hooks';
import { useKycStore, selectKycProgress, selectIsIdUploadComplete } from '../../src/store/kycStore';

const mockSession = {
  sessionId: 'session-kyc-1',
  status: 'pending' as const,
  tier: 2 as const,
  documents: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockDocument = {
  id: 'doc-1',
  type: 'passport' as const,
  side: 'front' as const,
  status: 'pending' as const,
  uploadedAt: '2026-01-01T00:00:00Z',
};

describe('useKycStore', () => {
  beforeEach(() => {
    useKycStore.setState({
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
    });
  });

  it('starts with intro step and no session', () => {
    const { result } = renderHook(() => useKycStore());
    expect(result.current.currentStep).toBe('intro');
    expect(result.current.session).toBeNull();
  });

  it('sets current step', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setCurrentStep('id_upload');
    });
    expect(result.current.currentStep).toBe('id_upload');
  });

  it('sets session', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setSession(mockSession);
    });
    expect(result.current.session).toEqual(mockSession);
  });

  it('sets captured ID front', () => {
    const { result } = renderHook(() => useKycStore());
    const doc = { uri: 'file:///front.jpg', documentType: 'passport' as const, side: 'front' as const };
    act(() => {
      result.current.setCapturedIdFront(doc);
    });
    expect(result.current.capturedIdFront).toEqual(doc);
  });

  it('sets captured selfie', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setCapturedSelfie('file:///selfie.jpg');
    });
    expect(result.current.capturedSelfie).toBe('file:///selfie.jpg');
  });

  it('adds uploaded documents immutably', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.addUploadedDocument(mockDocument);
    });
    expect(result.current.uploadedDocuments).toHaveLength(1);
    act(() => {
      result.current.addUploadedDocument({ ...mockDocument, id: 'doc-2' });
    });
    expect(result.current.uploadedDocuments).toHaveLength(2);
  });

  it('sets loading state', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.isLoading).toBe(true);
    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('sets and clears error', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setError('Something failed');
    });
    expect(result.current.error).toBe('Something failed');
    act(() => {
      result.current.setError(null);
    });
    expect(result.current.error).toBeNull();
  });

  it('resets all state on reset()', () => {
    const { result } = renderHook(() => useKycStore());
    act(() => {
      result.current.setSession(mockSession);
      result.current.setCapturedSelfie('file:///selfie.jpg');
      result.current.setCurrentStep('selfie');
      result.current.reset();
    });
    expect(result.current.session).toBeNull();
    expect(result.current.capturedSelfie).toBeNull();
    expect(result.current.currentStep).toBe('intro');
  });
});

describe('selectKycProgress', () => {
  it('returns 0 for intro step', () => {
    const state = useKycStore.getState();
    useKycStore.setState({ ...state, currentStep: 'intro' });
    expect(selectKycProgress(useKycStore.getState())).toBe(0);
  });

  it('returns 1 for status step', () => {
    const state = useKycStore.getState();
    useKycStore.setState({ ...state, currentStep: 'status' });
    expect(selectKycProgress(useKycStore.getState())).toBe(1);
  });
});

describe('selectIsIdUploadComplete', () => {
  it('returns false when no front captured', () => {
    useKycStore.setState({
      ...useKycStore.getState(),
      capturedIdFront: null,
      selectedDocumentType: 'passport',
    });
    expect(selectIsIdUploadComplete(useKycStore.getState())).toBe(false);
  });

  it('returns true for passport with only front', () => {
    useKycStore.setState({
      ...useKycStore.getState(),
      capturedIdFront: { uri: 'file:///front.jpg', documentType: 'passport', side: 'front' },
      capturedIdBack: null,
      selectedDocumentType: 'passport',
    });
    expect(selectIsIdUploadComplete(useKycStore.getState())).toBe(true);
  });

  it('returns false for national_id with only front (needs back)', () => {
    useKycStore.setState({
      ...useKycStore.getState(),
      capturedIdFront: { uri: 'file:///front.jpg', documentType: 'national_id', side: 'front' },
      capturedIdBack: null,
      selectedDocumentType: 'national_id',
    });
    expect(selectIsIdUploadComplete(useKycStore.getState())).toBe(false);
  });

  it('returns true for national_id with both front and back', () => {
    useKycStore.setState({
      ...useKycStore.getState(),
      capturedIdFront: { uri: 'file:///front.jpg', documentType: 'national_id', side: 'front' },
      capturedIdBack: { uri: 'file:///back.jpg', documentType: 'national_id', side: 'back' },
      selectedDocumentType: 'national_id',
    });
    expect(selectIsIdUploadComplete(useKycStore.getState())).toBe(true);
  });
});
