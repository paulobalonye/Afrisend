import {
  listCorridors,
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
  sourceCurrency: 'USD',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
};

const mockRateQuote: RateQuote = {
  corridorId: 'corridor-ng',
  sourceCurrency: 'USD',
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
  sourceCurrency: 'USD',
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

  it('fetches rates for given corridor and amount', async () => {
    mockGet.mockResolvedValueOnce(mockRateQuote);
    const result = await getRates({ corridorId: 'corridor-ng', sourceAmount: 100 });
    expect(result).toEqual(mockRateQuote);
    expect(mockGet).toHaveBeenCalledWith('/remittance/rates', {
      params: { corridorId: 'corridor-ng', sourceAmount: 100 },
    });
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
