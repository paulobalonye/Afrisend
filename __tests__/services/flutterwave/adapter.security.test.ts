/**
 * Security regression tests for Flutterwave adapter.
 * Covers HIGH findings from HIT-44 security review.
 */
import axios from 'axios';
import { createFlutterwaveAdapter } from '@/services/flutterwave/adapter';
import type { FlutterwaveAdapter } from '@/services/flutterwave/types';
import { FlutterwaveError } from '@/services/flutterwave/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TEST_SECRET_KEY = 'FLWSECK_TEST-abcdef123456';

const mockPost = jest.fn();
const mockGet = jest.fn();

function makeAdapter(extra: Record<string, unknown> = {}): FlutterwaveAdapter {
  mockedAxios.create.mockReturnValue({
    post: mockPost,
    get: mockGet,
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  } as unknown as ReturnType<typeof axios.create>);
  return createFlutterwaveAdapter({ secretKey: TEST_SECRET_KEY, ...extra });
}

// ---------------------------------------------------------------------------
// HIGH-1: Path traversal via unvalidated transferId
// ---------------------------------------------------------------------------
describe('HIGH-1: transferId path traversal validation', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    adapter = makeAdapter();
  });

  const maliciousIds = [
    '../secret',
    '../../etc/passwd',
    '123/../../admin',
    '123; DROP TABLE transfers',
    '<script>alert(1)</script>',
    '123 456',
    '',
    '  ',
    '12.34',
    '-1',
    '+5',
    '0x1F',
    '1e5',
  ];

  it.each(maliciousIds)(
    'throws FlutterwaveError for malicious transferId: %s',
    async (id) => {
      await expect(adapter.getTransferStatus(id)).rejects.toThrow(FlutterwaveError);
      expect(mockGet).not.toHaveBeenCalled();
    },
  );

  it('accepts a valid numeric string transferId', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer fetched',
        data: {
          id: 987654,
          reference: 'ref-001',
          status: 'SUCCESSFUL',
          amount: 5000,
          currency: 'NGN',
        },
      },
    });

    await expect(adapter.getTransferStatus('987654')).resolves.toBeDefined();
    expect(mockGet).toHaveBeenCalledWith('/transfers/987654', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// HIGH-2: Input validation on financial fields
// ---------------------------------------------------------------------------
describe('HIGH-2: financial field validation — initiateTransfer', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    adapter = makeAdapter();
  });

  describe('amount validation', () => {
    it('throws FlutterwaveError for Infinity amount', async () => {
      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: Infinity,
          narration: 'test',
          reference: 'ref-inf',
        }),
      ).rejects.toThrow(FlutterwaveError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('throws FlutterwaveError for NaN amount', async () => {
      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: NaN,
          narration: 'test',
          reference: 'ref-nan',
        }),
      ).rejects.toThrow(FlutterwaveError);
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('accountNumber NUBAN validation', () => {
    const invalidAccountNumbers = [
      '123456789',    // 9 digits (too short)
      '12345678901',  // 11 digits (too long)
      '069000003a',   // contains letter
      '',             // empty
      '          ',  // spaces
      'ABCDEFGHIJ',  // all letters
    ];

    it.each(invalidAccountNumbers)(
      'throws FlutterwaveError for invalid accountNumber: "%s"',
      async (accountNumber) => {
        await expect(
          adapter.initiateTransfer({
            accountNumber,
            bankCode: '044',
            accountName: 'Test',
            amount: 1000,
            narration: 'test',
            reference: 'ref-acct',
          }),
        ).rejects.toThrow(FlutterwaveError);
        expect(mockPost).not.toHaveBeenCalled();
      },
    );

    it('accepts a valid 10-digit NUBAN account number', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Transfer Queued Successfully',
          data: {
            id: 1, account_number: '0690000032', bank_code: '044', full_name: 'Test',
            amount: 1000, currency: 'NGN', narration: 'test', reference: 'ref-ok',
            status: 'NEW', created_at: '2026-03-28T10:00:00.000Z',
          },
        },
      });
      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: 1000,
          narration: 'test',
          reference: 'ref-ok',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('bankCode validation', () => {
    const invalidBankCodes = [
      '',
      '  ',
      'AB',      // too short (2 chars)
      'A'.repeat(10), // too long
      '04 4',   // space inside
    ];

    it.each(invalidBankCodes)(
      'throws FlutterwaveError for invalid bankCode: "%s"',
      async (bankCode) => {
        await expect(
          adapter.initiateTransfer({
            accountNumber: '0690000032',
            bankCode,
            accountName: 'Test',
            amount: 1000,
            narration: 'test',
            reference: 'ref-bank',
          }),
        ).rejects.toThrow(FlutterwaveError);
        expect(mockPost).not.toHaveBeenCalled();
      },
    );
  });

  describe('narration control character validation', () => {
    const dangerousNarrations = [
      'Payment\x00injection',
      'Transfer\ninjection',
      'Payment\rtest',
      'Test\x1bESC',
      'Control\x08backspace',
    ];

    it.each(dangerousNarrations)(
      'throws FlutterwaveError for narration with control chars: %j',
      async (narration) => {
        await expect(
          adapter.initiateTransfer({
            accountNumber: '0690000032',
            bankCode: '044',
            accountName: 'Test',
            amount: 1000,
            narration,
            reference: 'ref-narr',
          }),
        ).rejects.toThrow(FlutterwaveError);
        expect(mockPost).not.toHaveBeenCalled();
      },
    );

    it('accepts a normal narration string', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Transfer Queued Successfully',
          data: {
            id: 1, account_number: '0690000032', bank_code: '044', full_name: 'Test',
            amount: 1000, currency: 'NGN', narration: 'Payment for invoice 123',
            reference: 'ref-narr-ok', status: 'NEW', created_at: '2026-03-28T10:00:00.000Z',
          },
        },
      });
      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: 1000,
          narration: 'Payment for invoice 123',
          reference: 'ref-narr-ok',
        }),
      ).resolves.toBeDefined();
    });
  });
});

describe('HIGH-2: financial field validation — verifyAccount', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    adapter = makeAdapter();
  });

  const invalidAccountNumbers = [
    '123456789',    // 9 digits
    '12345678901',  // 11 digits
    '',
    'ABCDEFGHIJ',
  ];

  it.each(invalidAccountNumbers)(
    'throws FlutterwaveError for invalid accountNumber in verifyAccount: "%s"',
    async (accountNumber) => {
      await expect(
        adapter.verifyAccount({ accountNumber, bankCode: '044' }),
      ).rejects.toThrow(FlutterwaveError);
      expect(mockPost).not.toHaveBeenCalled();
    },
  );

  const invalidBankCodes = ['', '  ', 'AB', '04 4'];

  it.each(invalidBankCodes)(
    'throws FlutterwaveError for invalid bankCode in verifyAccount: "%s"',
    async (bankCode) => {
      await expect(
        adapter.verifyAccount({ accountNumber: '0690000032', bankCode }),
      ).rejects.toThrow(FlutterwaveError);
      expect(mockPost).not.toHaveBeenCalled();
    },
  );

  it('accepts valid account number and bank code', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Account details fetched',
        data: { account_number: '0690000032', account_name: 'Test Account', bank_id: 7 },
      },
    });
    await expect(
      adapter.verifyAccount({ accountNumber: '0690000032', bankCode: '044' }),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HIGH-3: callbackUrl SSRF risk
// ---------------------------------------------------------------------------
describe('HIGH-3: callbackUrl SSRF validation', () => {
  let adapter: FlutterwaveAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    adapter = makeAdapter({
      callbackAllowedDomains: ['webhook.example.com', 'payments.myapp.io'],
    });
  });

  const ssrfCallbackUrls = [
    // Malformed (not a valid URL)
    'not-a-url',
    // Non-HTTPS
    'http://webhook.example.com/cb',
    'ftp://webhook.example.com/cb',
    // RFC 1918 private ranges
    'https://192.168.1.1/webhook',
    'https://10.0.0.1/callback',
    'https://172.16.0.5/hook',
    'https://172.31.255.255/hook',
    // Loopback
    'https://127.0.0.1/admin',
    'https://localhost/admin',
    // Link-local
    'https://169.254.169.254/latest/meta-data',
    // IPv6 loopback
    'https://[::1]/callback',
    // Not on allowlist
    'https://attacker.com/steal',
    'https://evil.webhook.example.com/cb',
  ];

  it.each(ssrfCallbackUrls)(
    'throws FlutterwaveError for SSRF/invalid callbackUrl: %s',
    async (callbackUrl) => {
      await expect(
        adapter.initiateTransfer({
          accountNumber: '0690000032',
          bankCode: '044',
          accountName: 'Test',
          amount: 1000,
          narration: 'test',
          reference: 'ref-ssrf',
          callbackUrl,
        }),
      ).rejects.toThrow(FlutterwaveError);
      expect(mockPost).not.toHaveBeenCalled();
    },
  );

  it('accepts a valid HTTPS callbackUrl on the allowlist', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer Queued Successfully',
        data: {
          id: 1, account_number: '0690000032', bank_code: '044', full_name: 'Test',
          amount: 1000, currency: 'NGN', narration: 'test', reference: 'ref-cb-ok',
          status: 'NEW', created_at: '2026-03-28T10:00:00.000Z',
        },
      },
    });

    await expect(
      adapter.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 1000,
        narration: 'test',
        reference: 'ref-cb-ok',
        callbackUrl: 'https://webhook.example.com/payments/callback',
      }),
    ).resolves.toBeDefined();
  });

  it('allows transfer without callbackUrl when no allowlist configured', async () => {
    jest.resetAllMocks();
    const adapterNoAllowlist = makeAdapter(); // no callbackAllowedDomains
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Transfer Queued Successfully',
        data: {
          id: 1, account_number: '0690000032', bank_code: '044', full_name: 'Test',
          amount: 1000, currency: 'NGN', narration: 'test', reference: 'ref-no-cb',
          status: 'NEW', created_at: '2026-03-28T10:00:00.000Z',
        },
      },
    });

    await expect(
      adapterNoAllowlist.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 1000,
        narration: 'test',
        reference: 'ref-no-cb',
      }),
    ).resolves.toBeDefined();
  });

  it('throws FlutterwaveError when callbackUrl provided but no allowlist configured', async () => {
    jest.resetAllMocks();
    const adapterNoAllowlist = makeAdapter(); // no callbackAllowedDomains
    await expect(
      adapterNoAllowlist.initiateTransfer({
        accountNumber: '0690000032',
        bankCode: '044',
        accountName: 'Test',
        amount: 1000,
        narration: 'test',
        reference: 'ref-cb-no-allowlist',
        callbackUrl: 'https://webhook.example.com/cb',
      }),
    ).rejects.toThrow(FlutterwaveError);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
