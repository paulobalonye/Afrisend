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
import {
  listSupportedCorridors,
  getRates,
  initiatePayment,
  getPaymentStatus,
} from '@/lib/api/fx';

const mockCorridor = {
  id: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
  refreshIntervalSeconds: 60,
};

const mockQuote = {
  corridorId: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 145000,
  exchangeRate: 1450,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  quoteId: 'q-1',
};

const mockPayment = {
  id: 'pay-1',
  idempotencyKey: 'idem-1',
  corridorId: 'cor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 145000,
  exchangeRate: 1450,
  fee: 2.5,
  status: 'pending' as const,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

describe('FX API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listSupportedCorridors', () => {
    it('should call GET /fx/corridors', async () => {
      (client.get as jest.Mock).mockResolvedValue([mockCorridor]);
      const result = await listSupportedCorridors();
      expect(client.get).toHaveBeenCalledWith('/fx/corridors');
      expect(result).toEqual([mockCorridor]);
    });
  });

  describe('getRates', () => {
    it('should call POST /fx/rates', async () => {
      (client.post as jest.Mock).mockResolvedValue(mockQuote);
      const req = { corridorId: 'cor-1', sourceAmount: 100 };
      const result = await getRates(req);
      expect(client.post).toHaveBeenCalledWith('/fx/rates', req);
      expect(result).toEqual(mockQuote);
    });
  });

  describe('initiatePayment', () => {
    it('should call POST /remittance/initiate', async () => {
      (client.post as jest.Mock).mockResolvedValue(mockPayment);
      const req = {
        quoteId: 'q-1',
        recipientId: 'r-1',
        paymentMethod: 'open_banking' as const,
        idempotencyKey: 'idem-1',
      };
      const result = await initiatePayment(req);
      expect(client.post).toHaveBeenCalledWith('/remittance/initiate', req);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('getPaymentStatus', () => {
    it('should call GET /remittance/:id', async () => {
      (client.get as jest.Mock).mockResolvedValue(mockPayment);
      const result = await getPaymentStatus('pay-1');
      expect(client.get).toHaveBeenCalledWith('/remittance/pay-1');
      expect(result).toEqual(mockPayment);
    });
  });
});
