jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn().mockReturnValue(null),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn().mockReturnValue(null),
  clearAuthTokens: jest.fn(),
}));

jest.mock('@/lib/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

import * as client from '@/lib/api/client';
import { getTransactions, getTransaction } from '@/lib/api/transactions';

const mockTx = {
  id: 'tx-1',
  corridorId: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 145000,
  exchangeRate: 1450,
  fee: 2.5,
  status: 'completed' as const,
  recipientName: 'Grace Adeyemi',
  recipientCountry: 'NG',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:05:00Z',
};

describe('transactions API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getTransactions', () => {
    it('should call GET /transactions with no params by default', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockTx]);
      const result = await getTransactions();
      expect(client.get).toHaveBeenCalledWith('/transactions', { params: {} });
      expect(result).toEqual([mockTx]);
    });

    it('should pass status filter', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockTx]);
      await getTransactions({ status: 'completed' });
      expect(client.get).toHaveBeenCalledWith('/transactions', {
        params: { status: 'completed' },
      });
    });

    it('should pass limit and offset', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockTx]);
      await getTransactions({ limit: 10, offset: 20 });
      expect(client.get).toHaveBeenCalledWith('/transactions', {
        params: { limit: 10, offset: 20 },
      });
    });
  });

  describe('getTransaction', () => {
    it('should call GET /transactions/:id', async () => {
      (client.get as jest.Mock).mockResolvedValue(mockTx);
      const result = await getTransaction('tx-1');
      expect(client.get).toHaveBeenCalledWith('/transactions/tx-1');
      expect(result).toEqual(mockTx);
    });

    it('should URL-encode transaction id', async () => {
      (client.get as jest.Mock).mockResolvedValue(mockTx);
      await getTransaction('tx/special');
      expect(client.get).toHaveBeenCalledWith('/transactions/tx%2Fspecial');
    });
  });
});
