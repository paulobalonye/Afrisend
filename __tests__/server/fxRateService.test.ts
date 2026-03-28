/**
 * Unit tests for FxRateService.
 * TDD: tests written BEFORE implementation.
 *
 * External dependencies (DB, Redis, HTTP providers) are mocked.
 */

import {
  FxRateService,
  type IFxRateService,
  type FxQuote,
  type CorridorRate,
  type IFxRateCache,
  type IFxRateProvider,
  type IFxQuoteRepository,
  type ICorridorMarkupRepository,
  type CorridorMarkupConfig,
} from '@/server/services/fxRateService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMarkup(overrides?: Partial<CorridorMarkupConfig>): CorridorMarkupConfig {
  return {
    id: 'cfg-1',
    fromCurrency: 'USD',
    toCurrency: 'NGN',
    markupBps: 150,    // 1.5%
    minFee: 2.00,
    maxFee: 15.00,
    feeStructure: 'flat',
    ...overrides,
  };
}

function advanceTime(ms: number): void {
  jest.setSystemTime(new Date(Date.now() + ms));
}

// ─── Mock implementations ─────────────────────────────────────────────────────

class MockFxRateCache implements IFxRateCache {
  private store = new Map<string, { rate: number; fetchedAt: Date }>();

  async get(fromCurrency: string, toCurrency: string) {
    return this.store.get(`${fromCurrency}:${toCurrency}`) ?? null;
  }

  async set(fromCurrency: string, toCurrency: string, rate: number, fetchedAt: Date) {
    this.store.set(`${fromCurrency}:${toCurrency}`, { rate, fetchedAt });
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  simulateStale(fromCurrency: string, toCurrency: string, ageMs: number) {
    this.store.set(`${fromCurrency}:${toCurrency}`, {
      rate: 1500,
      fetchedAt: new Date(Date.now() - ageMs),
    });
  }
}

class MockFxRateProvider implements IFxRateProvider {
  name = 'mock-provider';
  private rates: Map<string, number> = new Map([
    ['USD:NGN', 1520],
    ['USD:GHS', 14.5],
    ['USD:KES', 130],
    ['EUR:NGN', 1650],
    ['GBP:NGN', 1900],
  ]);
  shouldFail = false;

  async fetchRates(fromCurrency: string, toCurrencies: string[]): Promise<Map<string, number>> {
    if (this.shouldFail) throw new Error('Provider unavailable');
    const result = new Map<string, number>();
    for (const toCurrency of toCurrencies) {
      const rate = this.rates.get(`${fromCurrency}:${toCurrency}`);
      if (rate !== undefined) result.set(toCurrency, rate);
    }
    return result;
  }

  setRate(fromCurrency: string, toCurrency: string, rate: number) {
    this.rates.set(`${fromCurrency}:${toCurrency}`, rate);
  }
}

class MockQuoteRepository implements IFxQuoteRepository {
  private quotes = new Map<string, FxQuote>();

  async save(quote: FxQuote): Promise<FxQuote> {
    this.quotes.set(quote.id, { ...quote });
    return { ...quote };
  }

  async findById(id: string): Promise<FxQuote | null> {
    return this.quotes.get(id) ?? null;
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    const q = this.quotes.get(id);
    if (q) this.quotes.set(id, { ...q, usedAt });
  }
}

class MockMarkupRepository implements ICorridorMarkupRepository {
  private configs: CorridorMarkupConfig[] = [
    makeMarkup(),
    makeMarkup({ id: 'cfg-2', fromCurrency: 'USD', toCurrency: 'GHS', markupBps: 150, minFee: 2, maxFee: 15 }),
    makeMarkup({ id: 'cfg-3', fromCurrency: 'USD', toCurrency: 'KES', markupBps: 130, minFee: 1.5, maxFee: 12 }),
    makeMarkup({ id: 'cfg-4', fromCurrency: 'EUR', toCurrency: 'NGN', markupBps: 160, minFee: 2.5, maxFee: 18 }),
  ];

  async findByCorridors(pairs: Array<{ from: string; to: string }>): Promise<CorridorMarkupConfig[]> {
    return this.configs.filter(c =>
      pairs.some(p => p.from === c.fromCurrency && p.to === c.toCurrency),
    );
  }

  async findByCorridor(fromCurrency: string, toCurrency: string): Promise<CorridorMarkupConfig | null> {
    return this.configs.find(c => c.fromCurrency === fromCurrency && c.toCurrency === toCurrency) ?? null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FxRateService', () => {
  let service: IFxRateService;
  let cache: MockFxRateCache;
  let primaryProvider: MockFxRateProvider;
  let fallbackProvider: MockFxRateProvider;
  let quoteRepo: MockQuoteRepository;
  let markupRepo: MockMarkupRepository;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-28T10:00:00Z'));

    cache = new MockFxRateCache();
    primaryProvider = new MockFxRateProvider();
    primaryProvider.name = 'currencybeacon';
    fallbackProvider = new MockFxRateProvider();
    fallbackProvider.name = 'openexchangerates';
    quoteRepo = new MockQuoteRepository();
    markupRepo = new MockMarkupRepository();

    service = new FxRateService({
      cache,
      primaryProvider,
      fallbackProvider,
      quoteRepo,
      markupRepo,
      staleThresholdMs: 5 * 60 * 1000,   // 5 minutes
      quoteTtlMs: 15 * 60 * 1000,         // 15 minutes
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Markup calculation ─────────────────────────────────────────────────────

  describe('calculateMarkup', () => {
    it('applies markup basis points on top of mid rate', () => {
      // 150 bps = 1.5% markup on a rate of 1520 → 1520 * 1.015 = 1542.8
      const result = FxRateService.applyMarkup(1520, 150);
      expect(result).toBeCloseTo(1542.8, 2);
    });

    it('handles zero markup bps', () => {
      const result = FxRateService.applyMarkup(1520, 0);
      expect(result).toBe(1520);
    });

    it('calculates fee correctly for flat structure with min/max clamp', () => {
      // 2% of 10 USD = 0.20, but min is 2.00
      const fee1 = FxRateService.calculateFee(10, makeMarkup({ markupBps: 200 }));
      expect(fee1).toBe(2.00); // clamped to minFee

      // 1.5% of 100 USD = 1.50, but min is 2.00
      const fee2 = FxRateService.calculateFee(100, makeMarkup({ markupBps: 150 }));
      expect(fee2).toBe(2.00); // clamped to minFee

      // 1.5% of 1000 USD = 15.00, exactly at maxFee
      const fee3 = FxRateService.calculateFee(1000, makeMarkup({ markupBps: 150 }));
      expect(fee3).toBe(15.00);

      // 1.5% of 2000 USD = 30, clamped to maxFee 15.00
      const fee4 = FxRateService.calculateFee(2000, makeMarkup({ markupBps: 150, maxFee: 15 }));
      expect(fee4).toBe(15.00);
    });

    it('applies no cap when maxFee is null', () => {
      const fee = FxRateService.calculateFee(10000, makeMarkup({ markupBps: 150, maxFee: null }));
      expect(fee).toBeCloseTo(150, 1); // 1.5% of 10000
    });
  });

  // ─── Rate fetching & caching ────────────────────────────────────────────────

  describe('getCurrentRates', () => {
    it('fetches rates from primary provider and caches them', async () => {
      const rates = await service.getCurrentRates();
      expect(rates.length).toBeGreaterThan(0);

      const ngnRate = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'NGN');
      expect(ngnRate).toBeDefined();
      expect(ngnRate!.midRate).toBe(1520);
      expect(ngnRate!.customerRate).toBeGreaterThan(1520);
    });

    it('returns cached rates when cache is warm', async () => {
      await cache.set('USD', 'NGN', 1500, new Date());
      const spy = jest.spyOn(primaryProvider, 'fetchRates');

      const rates = await service.getCurrentRates();
      const ngnRate = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'NGN');

      expect(ngnRate!.midRate).toBe(1500);
      // Provider should NOT have been called for the cached corridor
      const wasFetchedForNgn = spy.mock.calls.some(
        ([from, toCurrencies]) => from === 'USD' && (toCurrencies as string[]).includes('NGN'),
      );
      expect(wasFetchedForNgn).toBe(false);
    });

    it('falls back to secondary provider when primary fails', async () => {
      primaryProvider.shouldFail = true;
      fallbackProvider.setRate('USD', 'NGN', 1510);

      const rates = await service.getCurrentRates();
      const ngnRate = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'NGN');

      expect(ngnRate).toBeDefined();
      expect(ngnRate!.midRate).toBe(1510);
      expect(ngnRate!.provider).toBe('openexchangerates');
    });

    it('widens spread when provider has been down >5 min (stale detection)', async () => {
      // Seed cache with stale rate (6 minutes old)
      cache.simulateStale('USD', 'NGN', 6 * 60 * 1000);
      primaryProvider.shouldFail = true;
      fallbackProvider.shouldFail = true;

      const rates = await service.getCurrentRates();
      const ngnRate = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'NGN');

      // Should still return a rate but with wider spread (isStale = true)
      expect(ngnRate).toBeDefined();
      expect(ngnRate!.isStale).toBe(true);
    });

    it('throws when all providers fail and no cache exists', async () => {
      primaryProvider.shouldFail = true;
      fallbackProvider.shouldFail = true;

      await expect(service.getCurrentRates()).rejects.toThrow();
    });
  });

  // ─── Quote management ───────────────────────────────────────────────────────

  describe('createQuote', () => {
    beforeEach(async () => {
      // Pre-warm cache
      await cache.set('USD', 'NGN', 1520, new Date());
    });

    it('creates a quote with correct mid rate, customer rate, and fee', async () => {
      const quote = await service.createQuote({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });

      expect(quote.id).toBeTruthy();
      expect(quote.fromCurrency).toBe('USD');
      expect(quote.toCurrency).toBe('NGN');
      expect(quote.midRate).toBe(1520);
      expect(quote.customerRate).toBeCloseTo(1542.8, 2);  // 150 bps markup (1520 * 1.015)
      expect(quote.fee).toBe(2.00);  // min fee
      expect(quote.expiresAt.getTime()).toBe(
        new Date('2026-03-28T10:15:00Z').getTime()
      ); // 15 minutes from "now"
      expect(quote.usedAt).toBeNull();
    });

    it('rejects quote for unsupported corridor', async () => {
      await cache.set('USD', 'XYZ', 999, new Date());
      await expect(
        service.createQuote({ fromCurrency: 'USD', toCurrency: 'XYZ', amount: 100, direction: 'send' }),
      ).rejects.toThrow(/unsupported corridor/i);
    });

    it('rejects amount <= 0', async () => {
      await expect(
        service.createQuote({ fromCurrency: 'USD', toCurrency: 'NGN', amount: 0, direction: 'send' }),
      ).rejects.toThrow();
      await expect(
        service.createQuote({ fromCurrency: 'USD', toCurrency: 'NGN', amount: -10, direction: 'send' }),
      ).rejects.toThrow();
    });

    it('persists quote to repository', async () => {
      const quote = await service.createQuote({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });
      const saved = await quoteRepo.findById(quote.id);
      expect(saved).not.toBeNull();
      expect(saved!.id).toBe(quote.id);
    });
  });

  describe('validateAndLockQuote', () => {
    it('marks a valid unexpired quote as used', async () => {
      await cache.set('USD', 'NGN', 1520, new Date());
      const quote = await service.createQuote({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });

      const locked = await service.validateAndLockQuote(quote.id);
      expect(locked.usedAt).not.toBeNull();
    });

    it('rejects an expired quote', async () => {
      await cache.set('USD', 'NGN', 1520, new Date());
      const quote = await service.createQuote({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });

      // Advance time past expiry (15 min + 1 second)
      advanceTime(15 * 60 * 1000 + 1000);

      await expect(service.validateAndLockQuote(quote.id)).rejects.toThrow(/expired/i);
    });

    it('rejects a quote that has already been used', async () => {
      await cache.set('USD', 'NGN', 1520, new Date());
      const quote = await service.createQuote({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });

      await service.validateAndLockQuote(quote.id);
      await expect(service.validateAndLockQuote(quote.id)).rejects.toThrow(/already used/i);
    });

    it('rejects a non-existent quote id', async () => {
      await expect(service.validateAndLockQuote('non-existent-id')).rejects.toThrow(/not found/i);
    });
  });
});
