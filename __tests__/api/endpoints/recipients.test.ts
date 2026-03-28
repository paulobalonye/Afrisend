import {
  getRecipients,
  getRecipient,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  type Recipient,
  type CreateRecipientRequest,
} from '@/api/endpoints/recipients';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/api/client', () => ({
  get: (path: string, config?: unknown) => mockGet(path, config),
  post: (path: string, body?: unknown) => mockPost(path, body),
  patch: (path: string, body?: unknown) => mockPatch(path, body),
  del: (path: string) => mockDelete(path),
}));

const sampleRecipient: Recipient = {
  id: 'rec-001',
  userId: 'user-001',
  nickname: 'Mum',
  firstName: 'Grace',
  lastName: 'Adeyemi',
  country: 'NG',
  payoutMethod: 'mobile_money',
  accountDetails: {
    phone: '+2348012345678',
    network: 'MTN',
  },
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

describe('recipients API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getRecipients', () => {
    it('fetches all recipients from /recipients', async () => {
      mockGet.mockResolvedValue([sampleRecipient]);
      const result = await getRecipients();
      expect(mockGet).toHaveBeenCalledWith('/recipients', undefined);
      expect(result).toEqual([sampleRecipient]);
    });

    it('passes search query when provided', async () => {
      mockGet.mockResolvedValue([]);
      await getRecipients({ search: 'grace' });
      expect(mockGet).toHaveBeenCalledWith('/recipients', { params: { search: 'grace' } });
    });
  });

  describe('getRecipient', () => {
    it('fetches single recipient by id', async () => {
      mockGet.mockResolvedValue(sampleRecipient);
      const result = await getRecipient('rec-001');
      expect(mockGet).toHaveBeenCalledWith('/recipients/rec-001', undefined);
      expect(result).toEqual(sampleRecipient);
    });
  });

  describe('createRecipient', () => {
    it('posts to /recipients with recipient data', async () => {
      const request: CreateRecipientRequest = {
        nickname: 'Mum',
        firstName: 'Grace',
        lastName: 'Adeyemi',
        country: 'NG',
        payoutMethod: 'mobile_money',
        accountDetails: { phone: '+2348012345678', network: 'MTN' },
      };
      mockPost.mockResolvedValue(sampleRecipient);
      const result = await createRecipient(request);
      expect(mockPost).toHaveBeenCalledWith('/recipients', request);
      expect(result).toEqual(sampleRecipient);
    });
  });

  describe('updateRecipient', () => {
    it('patches /recipients/:id with updated fields', async () => {
      const updated = { ...sampleRecipient, nickname: 'Mom' };
      mockPatch.mockResolvedValue(updated);
      const result = await updateRecipient('rec-001', { nickname: 'Mom' });
      expect(mockPatch).toHaveBeenCalledWith('/recipients/rec-001', { nickname: 'Mom' });
      expect(result.nickname).toBe('Mom');
    });
  });

  describe('deleteRecipient', () => {
    it('calls DELETE /recipients/:id', async () => {
      mockDelete.mockResolvedValue(undefined);
      await deleteRecipient('rec-001');
      expect(mockDelete).toHaveBeenCalledWith('/recipients/rec-001');
    });
  });
});
