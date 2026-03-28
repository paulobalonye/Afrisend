/**
 * FX Rate Engine Service.
 *
 * Responsibilities:
 * - Fetch live rates from providers (primary → fallback)
 * - Cache rates in Redis with TTL
 * - Detect stale rates and widen spread accordingly
 * - Apply corridor-specific markup (basis points)
 * - Issue time-locked 15-minute quotes
 * - Validate and atomically lock quotes for Transaction Service
 */

import { randomUUID } from 'crypto';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type CorridorMarkupConfig = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  markupBps: number;
  minFee: number;
  maxFee: number | null;
  feeStructure: 'flat' | 'percentage' | 'tiered';
};

export type FxQuote = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  direction: 'send' | 'receive';
  midRate: number;
  customerRate: number;
  markupBps: number;
  fee: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type CorridorRate = {
  fromCurrency: string;
  toCurrency: string;
  midRate: number;
  customerRate: number;
  markupBps: number;
  provider: string;
  isStale: boolean;
  fetchedAt: Date;
};

export type CreateQuoteInput = {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  direction: 'send' | 'receive';
};

// ─── Port interfaces ──────────────────────────────────────────────────────────

export interface IFxRateCache {
  get(fromCurrency: string, toCurrency: string): Promise<{ rate: number; fetchedAt: Date } | null>;
  set(fromCurrency: string, toCurrency: string, rate: number, fetchedAt: Date): Promise<void>;
  keys(): Promise<string[]>;
}

export interface IFxRateProvider {
  name: string;
  fetchRates(fromCurrency: string, toCurrencies: string[]): Promise<Map<string, number>>;
}

export interface IFxQuoteRepository {
  save(quote: FxQuote): Promise<FxQuote>;
  findById(id: string): Promise<FxQuote | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
}

export interface ICorridorMarkupRepository {
  findByCorridors(pairs: Array<{ from: string; to: string }>): Promise<CorridorMarkupConfig[]>;
  findByCorridor(fromCurrency: string, toCurrency: string): Promise<CorridorMarkupConfig | null>;
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface IFxRateService {
  getCurrentRates(): Promise<CorridorRate[]>;
  createQuote(input: CreateQuoteInput): Promise<FxQuote>;
  validateAndLockQuote(quoteId: string): Promise<FxQuote>;
}

// ─── Supported corridors ──────────────────────────────────────────────────────

const SUPPORTED_CORRIDORS: Array<{ from: string; to: string }> = [
  { from: 'USD', to: 'NGN' }, { from: 'USD', to: 'GHS' }, { from: 'USD', to: 'KES' },
  { from: 'USD', to: 'TZS' }, { from: 'USD', to: 'UGX' }, { from: 'USD', to: 'ZAR' },
  { from: 'USD', to: 'ETB' }, { from: 'USD', to: 'XOF' }, { from: 'USD', to: 'XAF' },
  { from: 'USD', to: 'EGP' }, { from: 'USD', to: 'MAD' }, { from: 'USD', to: 'TND' },
  { from: 'USD', to: 'DZD' }, { from: 'USD', to: 'MZN' }, { from: 'USD', to: 'ZMW' },
  { from: 'EUR', to: 'NGN' }, { from: 'EUR', to: 'GHS' }, { from: 'EUR', to: 'KES' },
  { from: 'EUR', to: 'TZS' }, { from: 'EUR', to: 'ZAR' }, { from: 'EUR', to: 'XOF' },
  { from: 'EUR', to: 'XAF' }, { from: 'EUR', to: 'EGP' }, { from: 'EUR', to: 'MAD' },
  { from: 'GBP', to: 'NGN' }, { from: 'GBP', to: 'GHS' }, { from: 'GBP', to: 'KES' },
  { from: 'GBP', to: 'TZS' }, { from: 'GBP', to: 'ZAR' }, { from: 'GBP', to: 'XOF' },
  { from: 'GBP', to: 'EGP' },
];

// Additional spread (basis points) applied on top of normal markup when rate is stale
const STALE_SPREAD_BPS = 50;

// ─── Configuration ────────────────────────────────────────────────────────────

export type FxRateServiceConfig = {
  cache: IFxRateCache;
  primaryProvider: IFxRateProvider;
  fallbackProvider: IFxRateProvider;
  quoteRepo: IFxQuoteRepository;
  markupRepo: ICorridorMarkupRepository;
  /** ms before a cached rate is considered stale */
  staleThresholdMs: number;
  /** ms a quote remains valid */
  quoteTtlMs: number;
};

// ─── Implementation ───────────────────────────────────────────────────────────

export class FxRateService implements IFxRateService {
  private readonly config: FxRateServiceConfig;

  constructor(config: FxRateServiceConfig) {
    this.config = config;
  }

  // ── Static helpers (pure, easily unit-tested) ──────────────────────────────

  /** Apply markup in basis points to a mid rate. */
  static applyMarkup(midRate: number, markupBps: number): number {
    return midRate * (1 + markupBps / 10_000);
  }

  /** Calculate the fee for an amount given corridor markup config. */
  static calculateFee(amount: number, config: CorridorMarkupConfig): number {
    const rawFee = amount * (config.markupBps / 10_000);
    const clamped = Math.max(rawFee, config.minFee);
    if (config.maxFee !== null && config.maxFee !== undefined) {
      return Math.min(clamped, config.maxFee);
    }
    return clamped;
  }

  // ── Rate fetching ──────────────────────────────────────────────────────────

  async getCurrentRates(): Promise<CorridorRate[]> {
    const markupConfigs = await this.config.markupRepo.findByCorridors(SUPPORTED_CORRIDORS);
    const markupMap = new Map(
      markupConfigs.map(c => [`${c.fromCurrency}:${c.toCurrency}`, c]),
    );

    const results: CorridorRate[] = [];

    for (const { from, to } of SUPPORTED_CORRIDORS) {
      const cached = await this.config.cache.get(from, to);
      if (cached) {
        const ageMs = Date.now() - cached.fetchedAt.getTime();
        const isStale = ageMs > this.config.staleThresholdMs;
        const markup = markupMap.get(`${from}:${to}`);
        const markupBps = (markup?.markupBps ?? 0) + (isStale ? STALE_SPREAD_BPS : 0);

        results.push({
          fromCurrency: from,
          toCurrency: to,
          midRate: cached.rate,
          customerRate: FxRateService.applyMarkup(cached.rate, markupBps),
          markupBps,
          provider: 'cache',
          isStale,
          fetchedAt: cached.fetchedAt,
        });
        continue;
      }

      // Cache miss — fetch from providers
      const fetched = await this._fetchFromProviders(from, to);
      if (!fetched) continue;

      const markup = markupMap.get(`${from}:${to}`);
      const markupBps = markup?.markupBps ?? 0;

      results.push({
        fromCurrency: from,
        toCurrency: to,
        midRate: fetched.rate,
        customerRate: FxRateService.applyMarkup(fetched.rate, markupBps),
        markupBps,
        provider: fetched.provider,
        isStale: false,
        fetchedAt: new Date(),
      });
    }

    if (results.length === 0) {
      throw new Error('No FX rates available: all providers failed and cache is empty');
    }

    return results;
  }

  // ── Quote management ───────────────────────────────────────────────────────

  async createQuote(input: CreateQuoteInput): Promise<FxQuote> {
    if (input.amount <= 0) {
      throw new Error('amount must be a positive number');
    }

    const markup = await this.config.markupRepo.findByCorridor(input.fromCurrency, input.toCurrency);
    if (!markup) {
      throw new Error(`Unsupported corridor: ${input.fromCurrency}/${input.toCurrency}`);
    }

    const cached = await this.config.cache.get(input.fromCurrency, input.toCurrency);
    let midRate: number;
    let provider: string;

    if (cached) {
      midRate = cached.rate;
      provider = 'cache';
    } else {
      const fetched = await this._fetchFromProviders(input.fromCurrency, input.toCurrency);
      if (!fetched) {
        throw new Error(
          `No rate available for ${input.fromCurrency}/${input.toCurrency}: all providers failed`,
        );
      }
      midRate = fetched.rate;
      provider = fetched.provider;
    }

    const now = new Date();
    const quote: FxQuote = {
      id: randomUUID(),
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      amount: input.amount,
      direction: input.direction,
      midRate,
      customerRate: FxRateService.applyMarkup(midRate, markup.markupBps),
      markupBps: markup.markupBps,
      fee: FxRateService.calculateFee(input.amount, markup),
      expiresAt: new Date(now.getTime() + this.config.quoteTtlMs),
      usedAt: null,
      createdAt: now,
    };

    return this.config.quoteRepo.save(quote);
  }

  async validateAndLockQuote(quoteId: string): Promise<FxQuote> {
    const quote = await this.config.quoteRepo.findById(quoteId);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    if (quote.usedAt !== null) {
      throw new Error(`Quote ${quoteId} has already been used`);
    }

    const now = new Date();
    if (now > quote.expiresAt) {
      throw new Error(`Quote ${quoteId} has expired`);
    }

    await this.config.quoteRepo.markUsed(quoteId, now);
    return { ...quote, usedAt: now };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _fetchFromProviders(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ rate: number; provider: string } | null> {
    const tryProvider = async (
      provider: IFxRateProvider,
    ): Promise<{ rate: number; provider: string } | null> => {
      try {
        const rates = await provider.fetchRates(fromCurrency, [toCurrency]);
        const rate = rates.get(toCurrency);
        if (rate === undefined) return null;
        await this.config.cache.set(fromCurrency, toCurrency, rate, new Date());
        return { rate, provider: provider.name };
      } catch {
        return null;
      }
    };

    return (
      (await tryProvider(this.config.primaryProvider)) ??
      (await tryProvider(this.config.fallbackProvider))
    );
  }
}
