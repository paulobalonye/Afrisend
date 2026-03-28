/**
 * Payout Routing Service — TDD tests (RED → GREEN)
 *
 * Tests cover:
 *  - Provider selection by corridor + method
 *  - Multi-provider fallback when primary is unavailable
 *  - Circuit breaker opens after threshold failures
 *  - Circuit breaker half-open probe and recovery
 *  - Webhook status update forwarding to TransactionService
 *  - All top-5 corridors: NG, KE, GH, UG, TZ
 */

import {
  PayoutRoutingService,
  type IPayoutProvider,
  type PayoutMethod,
  type PayoutRequest,
  type PayoutResult,
  type PayoutStatusUpdate,
  type IPayoutRoutingService,
} from '../src/services/payoutRoutingService';
import { CircuitBreaker, CircuitState } from '../src/services/circuitBreaker';
import {
  DefaultTransactionService,
  TransactionStatus,
  type Transaction,
} from '../src/services/transactionService';

// ─── Mock provider factory ────────────────────────────────────────────────────

function makeMockProvider(
  name: string,
  overrides: Partial<IPayoutProvider> = {},
): jest.Mocked<IPayoutProvider> {
  const defaultResult: PayoutResult = {
    providerRef: `${name}-ref-123`,
    status: 'pending',
    provider: name,
    raw: {},
  };
  const obj = {
    name,
    supportedCountries: [] as string[],
    supportedMethods: [] as PayoutMethod[],
    initiatePayout: jest.fn<Promise<PayoutResult>, [PayoutRequest]>().mockResolvedValue(defaultResult),
    getPayoutStatus: jest.fn<Promise<PayoutResult>, [string]>().mockResolvedValue({ ...defaultResult, status: 'completed' }),
    ...overrides,
  };
  return obj as jest.Mocked<IPayoutProvider>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeMs: 100 });
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('allows calls through when CLOSED', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await cb.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('opens after failure threshold is reached', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('provider down'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }
    expect(cb.getState()).toBe(CircuitState.Open);
  });

  it('rejects immediately when OPEN without calling fn', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }
    fn.mockReset();
    await expect(cb.execute(fn)).rejects.toThrow(/circuit open/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after recovery window', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }
    // wait for recovery window
    await new Promise((r) => setTimeout(r, 150));
    expect(cb.getState()).toBe(CircuitState.HalfOpen);
  });

  it('closes again after a successful probe in HALF_OPEN', async () => {
    const failFn = jest.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failFn)).rejects.toThrow();
    }
    await new Promise((r) => setTimeout(r, 150));

    const successFn = jest.fn().mockResolvedValue('recovered');
    const result = await cb.execute(successFn);
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe(CircuitState.Closed);
  });

  it('reopens if the probe in HALF_OPEN fails', async () => {
    const failFn = jest.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failFn)).rejects.toThrow();
    }
    await new Promise((r) => setTimeout(r, 150));
    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitState.Open);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PayoutRoutingService — provider selection', () => {
  let mpesa: jest.Mocked<IPayoutProvider>;
  let mtnMomo: jest.Mocked<IPayoutProvider>;
  let airtelMoney: jest.Mocked<IPayoutProvider>;
  let flutterwave: jest.Mocked<IPayoutProvider>;
  let service: IPayoutRoutingService;

  beforeEach(() => {
    mpesa = makeMockProvider('mpesa', {
      supportedCountries: ['KE', 'TZ'],
      supportedMethods: ['mobile_money'],
    });
    mtnMomo = makeMockProvider('mtn_momo', {
      supportedCountries: ['GH', 'UG', 'RW'],
      supportedMethods: ['mobile_money'],
    });
    airtelMoney = makeMockProvider('airtel_money', {
      supportedCountries: ['UG', 'TZ', 'KE'],
      supportedMethods: ['mobile_money'],
    });
    flutterwave = makeMockProvider('flutterwave', {
      supportedCountries: ['NG', 'GH', 'KE'],
      supportedMethods: ['bank_transfer'],
    });

    service = new PayoutRoutingService([mpesa, mtnMomo, airtelMoney, flutterwave]);
  });

  const baseRequest = (): PayoutRequest => ({
    transactionId: 'tx-001',
    amount: 100,
    currency: 'NGN',
    destinationCountry: 'NG',
    method: 'bank_transfer',
    recipient: {
      name: 'Ada Obi',
      accountNumber: '1234567890',
      bankCode: '044',
      phoneNumber: null,
    },
  });

  it('routes NG bank_transfer to Flutterwave', async () => {
    const req = baseRequest();
    await service.route(req);
    expect(flutterwave.initiatePayout).toHaveBeenCalledWith(req);
    expect(mpesa.initiatePayout).not.toHaveBeenCalled();
  });

  it('routes KE mobile_money to M-Pesa', async () => {
    const req = { ...baseRequest(), destinationCountry: 'KE', currency: 'KES', method: 'mobile_money' as const };
    await service.route(req);
    expect(mpesa.initiatePayout).toHaveBeenCalledWith(req);
    expect(mtnMomo.initiatePayout).not.toHaveBeenCalled();
  });

  it('routes GH mobile_money to MTN MoMo', async () => {
    const req = { ...baseRequest(), destinationCountry: 'GH', currency: 'GHS', method: 'mobile_money' as const };
    await service.route(req);
    expect(mtnMomo.initiatePayout).toHaveBeenCalledWith(req);
    expect(mpesa.initiatePayout).not.toHaveBeenCalled();
  });

  it('routes UG mobile_money to MTN MoMo (primary)', async () => {
    const req = { ...baseRequest(), destinationCountry: 'UG', currency: 'UGX', method: 'mobile_money' as const };
    await service.route(req);
    expect(mtnMomo.initiatePayout).toHaveBeenCalledWith(req);
  });

  it('routes TZ mobile_money to M-Pesa', async () => {
    const req = { ...baseRequest(), destinationCountry: 'TZ', currency: 'TZS', method: 'mobile_money' as const };
    await service.route(req);
    expect(mpesa.initiatePayout).toHaveBeenCalledWith(req);
  });

  it('throws when no provider supports the corridor', async () => {
    const req = { ...baseRequest(), destinationCountry: 'ZM', currency: 'ZMW' };
    await expect(service.route(req)).rejects.toThrow(/no provider/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PayoutRoutingService — fallback on failure', () => {
  let primary: jest.Mocked<IPayoutProvider>;
  let fallback: jest.Mocked<IPayoutProvider>;
  let service: IPayoutRoutingService;

  const ugRequest = (): PayoutRequest => ({
    transactionId: 'tx-002',
    amount: 50,
    currency: 'UGX',
    destinationCountry: 'UG',
    method: 'mobile_money',
    recipient: {
      name: 'Kwame Mensah',
      accountNumber: null,
      bankCode: null,
      phoneNumber: '+256700000000',
    },
  });

  beforeEach(() => {
    // MTN MoMo = primary for UG; Airtel Money = fallback
    primary = makeMockProvider('mtn_momo', {
      supportedCountries: ['GH', 'UG', 'RW'],
      supportedMethods: ['mobile_money'],
      initiatePayout: jest.fn().mockRejectedValue(new Error('MTN unavailable')),
    });
    fallback = makeMockProvider('airtel_money', {
      supportedCountries: ['UG', 'TZ', 'KE'],
      supportedMethods: ['mobile_money'],
    });
    service = new PayoutRoutingService([primary, fallback]);
  });

  it('falls back to Airtel Money when MTN MoMo fails', async () => {
    const result = await service.route(ugRequest());
    expect(primary.initiatePayout).toHaveBeenCalled();
    expect(fallback.initiatePayout).toHaveBeenCalled();
    expect(result.provider).toBe('airtel_money');
  });

  it('throws when all fallbacks are exhausted', async () => {
    fallback.initiatePayout.mockRejectedValue(new Error('Airtel also down'));
    await expect(service.route(ugRequest())).rejects.toThrow(/all providers failed/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PayoutRoutingService — circuit breaker integration', () => {
  it('skips a provider whose circuit is open and uses fallback', async () => {
    const primary = makeMockProvider('mtn_momo', {
      supportedCountries: ['UG'],
      supportedMethods: ['mobile_money'],
      initiatePayout: jest.fn().mockRejectedValue(new Error('fail')),
    });
    const fallback = makeMockProvider('airtel_money', {
      supportedCountries: ['UG'],
      supportedMethods: ['mobile_money'],
    });

    // failureThreshold=1 so that a single failure opens the breaker
    const service = new PayoutRoutingService([primary, fallback], { failureThreshold: 1 });

    const req: PayoutRequest = {
      transactionId: 'tx-003',
      amount: 20,
      currency: 'UGX',
      destinationCountry: 'UG',
      method: 'mobile_money',
      recipient: { name: 'Test', accountNumber: null, bankCode: null, phoneNumber: '+256700000001' },
    };

    // First call: primary fails (circuit opens), fallback used
    const result1 = await service.route(req);
    expect(result1.provider).toBe('airtel_money');

    // Second call: primary circuit is open, skipped immediately, fallback used
    primary.initiatePayout.mockClear();
    const result2 = await service.route(req);
    expect(result2.provider).toBe('airtel_money');
    // primary.initiatePayout should not have been called because circuit is open
    expect(primary.initiatePayout).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PayoutRoutingService — webhook status update', () => {
  it('transitions transaction to completed on success webhook', async () => {
    const txService = new DefaultTransactionService();
    const provider = makeMockProvider('flutterwave', {
      supportedCountries: ['NG'],
      supportedMethods: ['bank_transfer'],
    });
    const service = new PayoutRoutingService([provider], {}, txService);

    // Create a transaction first
    const tx = await txService.initiate({
      userId: 'user-1',
      idempotencyKey: 'idem-1',
      amount: 100,
      currency: 'USDC',
      targetAmount: 150000,
      targetCurrency: 'NGN',
      fxRate: 1500,
    });
    // Move to processing so transition to completed is valid
    await txService.transitionTo(tx.id, TransactionStatus.Processing);

    const update: PayoutStatusUpdate = {
      transactionId: tx.id,
      providerRef: 'fw-ref-001',
      provider: 'flutterwave',
      status: 'completed',
    };

    await service.handleStatusUpdate(update);

    const updated = await txService.get(tx.id, 'user-1');
    expect(updated.status).toBe(TransactionStatus.Completed);
    expect(updated.payoutReference).toBe('fw-ref-001');
  });

  it('transitions transaction to failed on failed webhook', async () => {
    const txService = new DefaultTransactionService();
    const provider = makeMockProvider('mpesa', {
      supportedCountries: ['KE'],
      supportedMethods: ['mobile_money'],
    });
    const service = new PayoutRoutingService([provider], {}, txService);

    const tx = await txService.initiate({
      userId: 'user-2',
      idempotencyKey: 'idem-2',
      amount: 50,
      currency: 'USDC',
      targetAmount: 6500,
      targetCurrency: 'KES',
      fxRate: 130,
    });
    await txService.transitionTo(tx.id, TransactionStatus.Processing);

    const update: PayoutStatusUpdate = {
      transactionId: tx.id,
      providerRef: 'mpesa-ref-002',
      provider: 'mpesa',
      status: 'failed',
      failureReason: 'Insufficient funds',
    };

    await service.handleStatusUpdate(update);

    const updated = await txService.get(tx.id, 'user-2');
    expect(updated.status).toBe(TransactionStatus.Failed);
    expect(updated.payoutReference).toBe('mpesa-ref-002');
    expect(updated.failureReason).toBe('Insufficient funds');
  });
});
