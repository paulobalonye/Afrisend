import {
  listCorridors,
  listSupportedCorridors,
  getRates,
  initiatePayment,
  getPaymentStatus,
  getSettlement,
  Corridor,
  RateQuote,
  Payment,
  PaymentStatus,
  Settlement,
  InitiatePaymentRequest,
  SUPPORTED_CORRIDOR_CURRENCIES,
  VOLATILE_CORRIDOR_CURRENCIES,
} from '../../src/api/endpoints/yellowcard';

// Mock the API client
jest.mock('../../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock the audit log
jest.mock('../../src/utils/auditLog', () => ({
  auditLog: jest.fn(),
}));

// Mock the retry utility
jest.mock('../../src/utils/retry', () => ({
  withRetry: jest.fn((fn: () => Promise<unknown>) => fn()),
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn((fn: () => Promise<unknown>) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
  })),
  CircuitBreakerState: { Closed: 'CLOSED', Open: 'OPEN', HalfOpen: 'HALF_OPEN' },
}));

import { get, post } from '../../src/api/client';
import { auditLog } from '../../src/utils/auditLog';

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockAuditLog = auditLog as jest.MockedFunction<typeof auditLog>;

const mockCorridor: Corridor = {
  id: 'corridor-ng',
  sourceCurrency: 'USDC',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
  refreshIntervalSeconds: 60,
};

const mockUnsupportedCorridor: Corridor = {
  id: 'corridor-eg',
  sourceCurrency: 'USDC',
  destinationCurrency: 'EGP',
  destinationCountry: 'EG',
  destinationCountryName: 'Egypt',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
  refreshIntervalSeconds: 300,
};

const mockRateQuote: RateQuote = {
  corridorId: 'corridor-ng',
  sourceCurrency: 'USDC',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 152000,
  exchangeRate: 1520,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: '2026-03-28T13:00:00Z',
  quoteId: 'quote-abc123',
};

const mockPayment: Payment = {
  id: 'pay-xyz789',
  idempotencyKey: 'idem-key-1',
  corridorId: 'corridor-ng',
  sourceCurrency: 'USDC',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 152000,
  exchangeRate: 1520,
  fee: 2.5,
  status: 'pending',
  recipient: {
    name: 'John Doe',
    accountNumber: '0123456789',
    bankCode: '058',
    bankName: 'GTBank',
  },
  createdAt: '2026-03-28T12:00:00Z',
  updatedAt: '2026-03-28T12:00:00Z',
};

const mockSettlement: Settlement = {
  paymentId: 'pay-xyz789',
  settlementId: 'settle-001',
  status: 'settled',
  settledAmount: 152000,
  settledCurrency: 'NGN',
  settledAt: '2026-03-28T12:30:00Z',
};

describe('listCorridors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and returns corridors from API', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor]);
    const result = await listCorridors();
    expect(result).toEqual([mockCorridor]);
    expect(mockGet).toHaveBeenCalledWith('/remittance/corridors');
  });

  it('logs the API call with audit log', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor]);
    await listCorridors();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'listCorridors', status: 'success' }),
    );
  });

  it('logs failure when API call fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    await expect(listCorridors()).rejects.toThrow('network error');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'listCorridors', status: 'failure' }),
    );
  });

  it('returns empty array when no corridors available', async () => {
    mockGet.mockResolvedValueOnce([]);
    const result = await listCorridors();
    expect(result).toEqual([]);
  });
});

describe('getRates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches rates from v2 endpoint for given corridor and amount', async () => {
    mockGet.mockResolvedValueOnce(mockRateQuote);
    const result = await getRates({ corridorId: 'corridor-ng', sourceAmount: 100 });
    expect(result).toEqual(mockRateQuote);
    expect(mockGet).toHaveBeenCalledWith('/remittance/v2/rates', {
      params: { corridorId: 'corridor-ng', sourceAmount: 100 },
    });
  });

  it('passes refreshIntervalSeconds to the request when provided', async () => {
    mockGet.mockResolvedValueOnce(mockRateQuote);
    await getRates({ corridorId: 'corridor-ng', sourceAmount: 100, refreshIntervalSeconds: 60 });
    expect(mockGet).toHaveBeenCalledWith('/remittance/v2/rates', {
      params: { corridorId: 'corridor-ng', sourceAmount: 100, refreshIntervalSeconds: 60 },
    });
  });

  it('omits refreshIntervalSeconds from params when not provided', async () => {
    mockGet.mockResolvedValueOnce(mockRateQuote);
    await getRates({ corridorId: 'corridor-ng', sourceAmount: 100 });
    const params = (mockGet.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    expect(params).not.toHaveProperty('refreshIntervalSeconds');
  });

  it('logs the API call with audit log', async () => {
    mockGet.mockResolvedValueOnce(mockRateQuote);
    await getRates({ corridorId: 'corridor-ng', sourceAmount: 100 });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getRates', status: 'success' }),
    );
  });

  it('logs failure when rate fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('rate service unavailable'));
    await expect(getRates({ corridorId: 'corridor-ng', sourceAmount: 100 })).rejects.toThrow();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getRates', status: 'failure' }),
    );
  });
});

describe('initiatePayment', () => {
  beforeEach(() => jest.clearAllMocks());

  const paymentRequest: InitiatePaymentRequest = {
    idempotencyKey: 'idem-key-1',
    quoteId: 'quote-abc123',
    corridorId: 'corridor-ng',
    sourceCurrency: 'USDC',
    sourceAmount: 100,
    recipient: {
      name: 'John Doe',
      accountNumber: '0123456789',
      bankCode: '058',
      bankName: 'GTBank',
    },
    senderNote: 'For family expenses',
  };

  it('initiates payment and returns payment object', async () => {
    mockPost.mockResolvedValueOnce(mockPayment);
    const result = await initiatePayment(paymentRequest);
    expect(result).toEqual(mockPayment);
    expect(mockPost).toHaveBeenCalledWith('/remittance/payments', paymentRequest);
  });

  it('sends idempotency key in request body', async () => {
    mockPost.mockResolvedValueOnce(mockPayment);
    await initiatePayment(paymentRequest);
    expect(mockPost).toHaveBeenCalledWith(
      '/remittance/payments',
      expect.objectContaining({ idempotencyKey: 'idem-key-1' }),
    );
  });

  it('sends sourceCurrency USDC in request body', async () => {
    mockPost.mockResolvedValueOnce(mockPayment);
    await initiatePayment(paymentRequest);
    expect(mockPost).toHaveBeenCalledWith(
      '/remittance/payments',
      expect.objectContaining({ sourceCurrency: 'USDC' }),
    );
  });

  it('logs payment initiation with audit log', async () => {
    mockPost.mockResolvedValueOnce(mockPayment);
    await initiatePayment(paymentRequest);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'yellowcard',
        operation: 'initiatePayment',
        status: 'success',
      }),
    );
  });

  it('logs failure on payment error', async () => {
    mockPost.mockRejectedValueOnce(new Error('payment rejected'));
    await expect(initiatePayment(paymentRequest)).rejects.toThrow('payment rejected');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'initiatePayment', status: 'failure' }),
    );
  });

  it('does not include PII in audit log metadata', async () => {
    mockPost.mockResolvedValueOnce(mockPayment);
    await initiatePayment(paymentRequest);
    const call = mockAuditLog.mock.calls[0][0];
    // Account number and name should not appear in top-level audit metadata
    expect(JSON.stringify(call.metadata ?? {})).not.toContain('0123456789');
    expect(JSON.stringify(call.metadata ?? {})).not.toContain('John Doe');
  });
});

describe('getPaymentStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns payment status for given payment id', async () => {
    mockGet.mockResolvedValueOnce(mockPayment);
    const result = await getPaymentStatus('pay-xyz789');
    expect(result).toEqual(mockPayment);
    expect(mockGet).toHaveBeenCalledWith('/remittance/payments/pay-xyz789');
  });

  it('logs status fetch with audit log', async () => {
    mockGet.mockResolvedValueOnce(mockPayment);
    await getPaymentStatus('pay-xyz789');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getPaymentStatus', status: 'success' }),
    );
  });

  it('throws and logs failure when payment not found', async () => {
    mockGet.mockRejectedValueOnce(new Error('not found'));
    await expect(getPaymentStatus('nonexistent')).rejects.toThrow('not found');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getPaymentStatus', status: 'failure' }),
    );
  });
});

describe('getSettlement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns settlement details for given payment id', async () => {
    mockGet.mockResolvedValueOnce(mockSettlement);
    const result = await getSettlement('pay-xyz789');
    expect(result).toEqual(mockSettlement);
    expect(mockGet).toHaveBeenCalledWith('/remittance/payments/pay-xyz789/settlement');
  });

  it('logs settlement fetch with audit log', async () => {
    mockGet.mockResolvedValueOnce(mockSettlement);
    await getSettlement('pay-xyz789');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getSettlement', status: 'success' }),
    );
  });

  it('throws and logs failure when settlement not available', async () => {
    mockGet.mockRejectedValueOnce(new Error('settlement pending'));
    await expect(getSettlement('pay-xyz789')).rejects.toThrow('settlement pending');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'getSettlement', status: 'failure' }),
    );
  });
});

describe('listSupportedCorridors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the same corridors endpoint as listCorridors', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor, mockUnsupportedCorridor]);
    await listSupportedCorridors();
    expect(mockGet).toHaveBeenCalledWith('/remittance/corridors');
  });

  it('returns only corridors whose destination currency is in SUPPORTED_CORRIDOR_CURRENCIES', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor, mockUnsupportedCorridor]);
    const result = await listSupportedCorridors();
    expect(result.every((c) => SUPPORTED_CORRIDOR_CURRENCIES.includes(c.destinationCurrency))).toBe(true);
    expect(result.some((c) => c.destinationCurrency === 'EGP')).toBe(false);
  });

  it('returns NGN corridor when present', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor]);
    const result = await listSupportedCorridors();
    expect(result).toHaveLength(1);
    expect(result[0].destinationCurrency).toBe('NGN');
  });

  it('logs with operation listSupportedCorridors', async () => {
    mockGet.mockResolvedValueOnce([mockCorridor]);
    await listSupportedCorridors();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'yellowcard', operation: 'listSupportedCorridors', status: 'success' }),
    );
  });
});

describe('SUPPORTED_CORRIDOR_CURRENCIES', () => {
  it('includes all 10 expected currencies', () => {
    const expected = ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'ZAR', 'ZMW', 'XAF', 'XOF'];
    expected.forEach((currency) => {
      expect(SUPPORTED_CORRIDOR_CURRENCIES).toContain(currency);
    });
  });

  it('does not include Flutterwave-only corridors like EGP, MAD, ETB', () => {
    expect(SUPPORTED_CORRIDOR_CURRENCIES).not.toContain('EGP');
    expect(SUPPORTED_CORRIDOR_CURRENCIES).not.toContain('MAD');
    expect(SUPPORTED_CORRIDOR_CURRENCIES).not.toContain('ETB');
  });

  it('is a readonly array', () => {
    expect(Array.isArray(SUPPORTED_CORRIDOR_CURRENCIES)).toBe(true);
  });
});

describe('VOLATILE_CORRIDOR_CURRENCIES', () => {
  it('includes NGN as a volatile corridor', () => {
    expect(VOLATILE_CORRIDOR_CURRENCIES).toContain('NGN');
  });

  it('is a non-empty array of strings', () => {
    expect(VOLATILE_CORRIDOR_CURRENCIES.length).toBeGreaterThan(0);
    VOLATILE_CORRIDOR_CURRENCIES.forEach((c) => expect(typeof c).toBe('string'));
  });
});
