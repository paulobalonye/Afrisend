jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn().mockReturnValue(null),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn().mockReturnValue(null),
  clearAuthTokens: jest.fn(),
}));

jest.mock('@/lib/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public statusCode: number, message: string, public code?: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import * as client from '@/lib/api/client';
import {
  getRecipients,
  getRecipient,
  createRecipient,
  updateRecipient,
  deleteRecipient,
} from '@/lib/api/recipients';

const mockRecipient = {
  id: 'r-1',
  userId: 'u-1',
  nickname: 'Mum',
  firstName: 'Grace',
  lastName: 'Adeyemi',
  country: 'NG',
  payoutMethod: 'bank_transfer' as const,
  accountDetails: { accountNumber: '0123456789', bankCode: '058', bankName: 'GTBank' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('recipients API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getRecipients', () => {
    it('should call GET /recipients', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockRecipient]);
      const result = await getRecipients();
      expect(client.get).toHaveBeenCalledWith('/recipients', undefined);
      expect(result).toEqual([mockRecipient]);
    });

    it('should pass search param when provided', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockRecipient]);
      await getRecipients('Grace');
      expect(client.get).toHaveBeenCalledWith('/recipients', { params: { search: 'Grace' } });
    });
  });

  describe('getRecipient', () => {
    it('should call GET /recipients/:id', async () => {
      (client.get as jest.Mock).mockResolvedValue(mockRecipient);
      const result = await getRecipient('r-1');
      expect(client.get).toHaveBeenCalledWith('/recipients/r-1');
      expect(result).toEqual(mockRecipient);
    });
  });

  describe('createRecipient', () => {
    it('should call POST /recipients with data', async () => {
      (client.post as jest.Mock).mockResolvedValue(mockRecipient);
      const data = {
        nickname: 'Mum',
        firstName: 'Grace',
        lastName: 'Adeyemi',
        country: 'NG',
        payoutMethod: 'bank_transfer' as const,
        accountDetails: { accountNumber: '0123456789', bankCode: '058', bankName: 'GTBank' },
      };
      const result = await createRecipient(data);
      expect(client.post).toHaveBeenCalledWith('/recipients', data);
      expect(result).toEqual(mockRecipient);
    });
  });

  describe('updateRecipient', () => {
    it('should call PATCH /recipients/:id', async () => {
      (client.patch as jest.Mock).mockResolvedValue({ ...mockRecipient, nickname: 'Updated' });
      const result = await updateRecipient('r-1', { nickname: 'Updated' });
      expect(client.patch).toHaveBeenCalledWith('/recipients/r-1', { nickname: 'Updated' });
      expect(result.nickname).toBe('Updated');
    });
  });

  describe('deleteRecipient', () => {
    it('should call DELETE /recipients/:id', async () => {
      (client.del as jest.Mock).mockResolvedValue(undefined);
      await deleteRecipient('r-1');
      expect(client.del).toHaveBeenCalledWith('/recipients/r-1');
    });
  });
});
