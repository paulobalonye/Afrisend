import axios from 'axios';
import { createFlutterwaveAdapter } from '@/services/flutterwave/adapter';
import type { FlutterwaveAdapter } from '@/services/flutterwave/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TEST_SECRET_KEY = 'FLWSECK_TEST-abcdef123456';

// Mock the axios instance create
const mockPost = jest.fn();
const mockGet = jest.fn();

describe('createFlutterwaveAdapter', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    // Re-setup the axios.create mock after reset
    mockedAxios.create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);
    adapter = createFlutterwaveAdapter({ secretKey: TEST_SECRET_KEY });
  });

  describe('verifyAccount', () => {
    it('resolves account name for valid account number and bank code', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Account details fetched',
          data: {
            account_number: '0690000032',
            account_name: 'Test Account',
            bank_id: 7,
          },
        },
      });

      const result = await adapter.verifyAccount({
        accountNumber: '0690000032',
        bankCode: '044',
      });

      expect(result).toEqual({
        accountNumber: '0690000032',
        accountName: 'Test Account',
        bankCode: '044',
      });
      expect(mockPost).toHaveBeenCalledWith(
        '/accounts/resolve',
        { account_number: '0690000032', account_bank: '044' },
        expect.any(Object),
      );
    });

    it('throws FlutterwaveError when API returns non-success status', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'error',
          message: 'Account not found',
          data: null,
        },
      });

      await expect(
        adapter.verifyAccount({ accountNumber: '0000000000', bankCode: '044' }),
      ).rejects.toThrow('Account not found');
    });

    it('throws on network error after retries', async () => {
      // 3 rejections for maxRetries=3 default
      mockPost
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'));
      await expect(
        adapter.verifyAccount({ accountNumber: '0690000032', bankCode: '044' }),
      ).rejects.toThrow('Network Error');
      expect(mockPost).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('initiateTransfer', () => {
    it('sends transfer request with idempotency key and returns transfer details', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Transfer Queued Successfully',
          data: {
            id: 987654,
            account_number: '0690000032',
            bank_code: '044',
            full_name: 'Test Account',
            amount: 5000,
            currency: 'NGN',
            narration: 'Payment for services',
            reference: 'ref-idem-001',
            status: 'NEW',
            created_at: '2026-03-28T10:00:00.000Z',
          },
        },
      });

      const result = await adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test Account',
        amount: 5000,
        narration: 'Payment for services',
        reference: 'ref-idem-001',
      });

      expect(result).toMatchObject({
        id: '987654',
        reference: 'ref-idem-001',
        status: 'NEW',
        amount: 5000,
        currency: 'NGN',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/transfers',
        expect.objectContaining({
          reference: 'ref-idem-001',
          account_number: '0690000032',
          account_bank: '044',
          amount: 5000,
          currency: 'NGN',
          narration: 'Payment for services',
        }),
        expect.any(Object),
      );
    });

    it('includes idempotency header on transfer request', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Transfer Queued Successfully',
          data: {
            id: 1,
            account_number: '0690000032',
            bank_code: '044',
            full_name: 'Test',
            amount: 1000,
            currency: 'NGN',
            narration: 'test',
            reference: 'ref-001',
            status: 'NEW',
            created_at: '2026-03-28T10:00:00.000Z',
          },
        },
      });

      await adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 1000,
        narration: 'test',
        reference: 'ref-001',
      });

      const callConfig = mockPost.mock.calls[0][2] as { headers?: Record<string, string> };
      expect(callConfig.headers).toBeDefined();
    });

    it('throws FlutterwaveError on API failure', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'error',
          message: 'Insufficient balance',
          data: null,
        },
      });

      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: 999999999,
          narration: 'test',
          reference: 'ref-002',
        }),
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('getTransferStatus', () => {
    it('returns the current status of a transfer by ID', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Transfer fetched',
          data: {
            id: 987654,
            reference: 'ref-idem-001',
            status: 'SUCCESSFUL',
            amount: 5000,
            currency: 'NGN',
            complete_message: 'Transaction was successful',
            created_at: '2026-03-28T10:00:00.000Z',
            complete_time: '2026-03-28T10:01:00.000Z',
          },
        },
      });

      const result = await adapter.getTransferStatus('987654');

      expect(result).toMatchObject({
        id: '987654',
        reference: 'ref-idem-001',
        status: 'SUCCESSFUL',
        amount: 5000,
        currency: 'NGN',
      });
      expect(mockGet).toHaveBeenCalledWith('/transfers/987654', expect.any(Object));
    });

    it('throws FlutterwaveError when transfer not found', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          status: 'error',
          message: 'Transfer not found',
          data: null,
        },
      });

      // Use a valid numeric ID; the adapter validates format before the API call
      await expect(adapter.getTransferStatus('9999999')).rejects.toThrow('Transfer not found');
    });
  });
});

describe('createFlutterwaveAdapter — optional fields', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedAxios.create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    } as unknown as ReturnType<typeof axios.create>);
    adapter = createFlutterwaveAdapter({
      secretKey: TEST_SECRET_KEY,
      callbackAllowedDomains: ['example.com'],
    });
  });

  it('includes callbackUrl in transfer payload when provided', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer Queued Successfully',
        data: {
          id: 1,
          account_number: '0690000032',
          bank_code: '044',
          full_name: 'Test',
          amount: 1000,
          currency: 'NGN',
          narration: 'test',
          reference: 'ref-cb-001',
          status: 'NEW',
          created_at: '2026-03-28T10:00:00.000Z',
        },
      },
    });

    await adapter.initiateTransfer({
      accountNumber: '0690000032',
      bankCode: '044',
      accountName: 'Test',
      amount: 1000,
      narration: 'test',
      reference: 'ref-cb-001',
      callbackUrl: 'https://example.com/webhook',
    });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.callback_url).toBe('https://example.com/webhook');
  });

  it('maps completedAt when complete_time is present in transfer response', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer Queued Successfully',
        data: {
          id: 2,
          account_number: '0690000032',
          bank_code: '044',
          full_name: 'Test',
          amount: 2000,
          currency: 'NGN',
          narration: 'test',
          reference: 'ref-complete-001',
          status: 'SUCCESSFUL',
          created_at: '2026-03-28T10:00:00.000Z',
          complete_time: '2026-03-28T10:01:00.000Z',
        },
      },
    });

    const result = await adapter.initiateTransfer({
      accountNumber: '0690000032',
      bankCode: '044',
      accountName: 'Test',
      amount: 2000,
      narration: 'test',
      reference: 'ref-complete-001',
    });

    expect(result.completedAt).toBe('2026-03-28T10:01:00.000Z');
  });

  it('maps completedAt in getTransferStatus when complete_time is present', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer fetched',
        data: {
          id: 3,
          reference: 'ref-status-001',
          status: 'SUCCESSFUL',
          amount: 3000,
          currency: 'NGN',
          created_at: '2026-03-28T10:00:00.000Z',
          complete_time: '2026-03-28T10:02:00.000Z',
        },
      },
    });

    const result = await adapter.getTransferStatus('3');
    expect(result.completedAt).toBe('2026-03-28T10:02:00.000Z');
  });
});

describe('createFlutterwaveAdapter — configuration validation', () => {
  it('throws when secretKey is empty', () => {
    expect(() => createFlutterwaveAdapter({ secretKey: '' })).toThrow('FLUTTERWAVE_SECRET_KEY is required');
  });
});

describe('createFlutterwaveAdapter — amount validation guard (L1)', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedAxios.create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    } as unknown as ReturnType<typeof axios.create>);
    adapter = createFlutterwaveAdapter({ secretKey: TEST_SECRET_KEY });
  });

  it('throws immediately when amount is zero', async () => {
    await expect(
      adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 0,
        narration: 'test',
        reference: 'ref-zero',
      }),
    ).rejects.toThrow('Invalid amount');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('throws immediately when amount is negative', async () => {
    await expect(
      adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: -100,
        narration: 'test',
        reference: 'ref-neg',
      }),
    ).rejects.toThrow('Invalid amount');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not throw for a positive amount (proceeds to API call)', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer Queued Successfully',
        data: {
          id: 1,
          account_number: '0690000032',
          bank_code: '044',
          full_name: 'Test',
          amount: 1,
          currency: 'NGN',
          narration: 'test',
          reference: 'ref-positive',
          status: 'NEW',
          created_at: '2026-03-28T10:00:00.000Z',
        },
      },
    });

    await expect(
      adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 1,
        narration: 'test',
        reference: 'ref-positive',
      }),
    ).resolves.toBeDefined();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
