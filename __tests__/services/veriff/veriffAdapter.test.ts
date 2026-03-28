import {
  createVeriffSession,
  getSessionDecision,
  VeriffDecision,
  VeriffSessionStatus,
} from '../../../src/services/veriff/veriffAdapter';
import { post, get } from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const mockPost = post as jest.MockedFunction<typeof post>;
const mockGet = get as jest.MockedFunction<typeof get>;

describe('createVeriffSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the backend to create a session and returns session data', async () => {
    const sessionResponse = {
      sessionId: 'sess_abc123',
      sessionUrl: 'https://alchemy.veriff.com/v/eyJhbGciOiJIUzI1NiJ9',
      vendorData: 'user_id_42',
      status: 'created' as VeriffSessionStatus,
    };
    mockPost.mockResolvedValueOnce(sessionResponse);

    const result = await createVeriffSession({
      vendorData: 'user_id_42',
      documentType: 'passport',
      countryCode: 'NG',
    });

    expect(mockPost).toHaveBeenCalledWith('/kyc/veriff/sessions', {
      vendorData: 'user_id_42',
      documentType: 'passport',
      countryCode: 'NG',
    });
    expect(result.sessionId).toBe('sess_abc123');
    expect(result.sessionUrl).toBe('https://alchemy.veriff.com/v/eyJhbGciOiJIUzI1NiJ9');
    expect(result.status).toBe('created');
  });

  it('throws when the backend returns an error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      createVeriffSession({
        vendorData: 'user_id_42',
        documentType: 'passport',
        countryCode: 'NG',
      }),
    ).rejects.toThrow('Network error');
  });

  it('uses default documentType when not provided', async () => {
    const sessionResponse = {
      sessionId: 'sess_def456',
      sessionUrl: 'https://alchemy.veriff.com/v/token2',
      vendorData: 'user_id_99',
      status: 'created' as VeriffSessionStatus,
    };
    mockPost.mockResolvedValueOnce(sessionResponse);

    await createVeriffSession({ vendorData: 'user_id_99', countryCode: 'KE' });

    expect(mockPost).toHaveBeenCalledWith('/kyc/veriff/sessions', {
      vendorData: 'user_id_99',
      documentType: 'passport',
      countryCode: 'KE',
    });
  });
});

describe('getSessionDecision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns approved decision from backend', async () => {
    const decisionResponse: VeriffDecision = {
      sessionId: 'sess_abc123',
      status: 'approved',
      code: 9001,
      reason: null,
      reasonCode: null,
      checkedAt: '2026-03-28T10:00:00Z',
    };
    mockGet.mockResolvedValueOnce(decisionResponse);

    const result = await getSessionDecision('sess_abc123');

    expect(mockGet).toHaveBeenCalledWith('/kyc/veriff/sessions/sess_abc123/decision');
    expect(result.status).toBe('approved');
    expect(result.sessionId).toBe('sess_abc123');
    expect(result.code).toBe(9001);
  });

  it('returns declined decision with reason', async () => {
    const decisionResponse: VeriffDecision = {
      sessionId: 'sess_xyz789',
      status: 'declined',
      code: 9102,
      reason: 'Document expired',
      reasonCode: 102,
      checkedAt: '2026-03-28T10:05:00Z',
    };
    mockGet.mockResolvedValueOnce(decisionResponse);

    const result = await getSessionDecision('sess_xyz789');

    expect(result.status).toBe('declined');
    expect(result.reason).toBe('Document expired');
    expect(result.reasonCode).toBe(102);
  });

  it('returns resubmission_requested decision', async () => {
    const decisionResponse: VeriffDecision = {
      sessionId: 'sess_rew001',
      status: 'resubmission_requested',
      code: 9103,
      reason: 'Document not readable',
      reasonCode: 103,
      checkedAt: '2026-03-28T10:10:00Z',
    };
    mockGet.mockResolvedValueOnce(decisionResponse);

    const result = await getSessionDecision('sess_rew001');

    expect(result.status).toBe('resubmission_requested');
  });

  it('returns review decision when still processing', async () => {
    const decisionResponse: VeriffDecision = {
      sessionId: 'sess_pend01',
      status: 'review',
      code: 9104,
      reason: null,
      reasonCode: null,
      checkedAt: null,
    };
    mockGet.mockResolvedValueOnce(decisionResponse);

    const result = await getSessionDecision('sess_pend01');

    expect(result.status).toBe('review');
    expect(result.checkedAt).toBeNull();
  });

  it('throws when session not found', async () => {
    mockGet.mockRejectedValueOnce(new Error('Session not found'));

    await expect(getSessionDecision('nonexistent')).rejects.toThrow('Session not found');
  });
});
