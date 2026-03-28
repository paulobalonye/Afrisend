/**
 * Integration tests for FX routes.
 * TDD: tests written BEFORE route implementation.
 *
 * Uses supertest against a minimal Express app wired with a mock IFxRateService.
 */

import request from 'supertest';
import express from 'express';
import type { Application } from 'express';

import { createFxRouter } from '@/server/routes/fx';
import type { IFxRateService, FxQuote, CorridorRate } from '@/server/services/fxRateService';
import { globalErrorHandler, notFound } from '@/server/middleware/errorHandler';

// ─── Mock service ─────────────────────────────────────────────────────────────

function makeQuote(overrides?: Partial<FxQuote>): FxQuote {
  return {
    id: 'quote-abc-123',
    fromCurrency: 'USD',
    toCurrency: 'NGN',
    amount: 100,
    direction: 'send',
    midRate: 1520,
    customerRate: 1542.8,
    markupBps: 150,
    fee: 2.00,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRate(overrides?: Partial<CorridorRate>): CorridorRate {
  return {
    fromCurrency: 'USD',
    toCurrency: 'NGN',
    midRate: 1520,
    customerRate: 1542.8,
    markupBps: 150,
    provider: 'currencybeacon',
    isStale: false,
    fetchedAt: new Date(),
    ...overrides,
  };
}

class MockFxRateService implements IFxRateService {
  getCurrentRatesMock: jest.Mock = jest.fn();
  createQuoteMock: jest.Mock = jest.fn();
  validateAndLockQuoteMock: jest.Mock = jest.fn();

  async getCurrentRates(): Promise<CorridorRate[]> {
    return this.getCurrentRatesMock();
  }

  async createQuote(input: Parameters<IFxRateService['createQuote']>[0]): Promise<FxQuote> {
    return this.createQuoteMock(input);
  }

  async validateAndLockQuote(quoteId: string): Promise<FxQuote> {
    return this.validateAndLockQuoteMock(quoteId);
  }
}

function buildApp(fxService: IFxRateService): Application {
  const app = express();
  app.use(express.json());
  app.use('/fx', createFxRouter(fxService));
  app.use((_req, res) => notFound(res));
  app.use(globalErrorHandler);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FX Routes', () => {
  let fxService: MockFxRateService;
  let app: Application;

  beforeEach(() => {
    fxService = new MockFxRateService();
    app = buildApp(fxService);
  });

  // ── GET /fx/rates ──────────────────────────────────────────────────────────

  describe('GET /fx/rates', () => {
    it('returns 200 with all corridor rates', async () => {
      const rates = [
        makeRate(),
        makeRate({ fromCurrency: 'USD', toCurrency: 'GHS', midRate: 14.5, customerRate: 14.72 }),
      ];
      fxService.getCurrentRatesMock.mockResolvedValue(rates);

      const res = await request(app).get('/fx/rates');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].fromCurrency).toBe('USD');
      expect(res.body.data[0].toCurrency).toBe('NGN');
    });

    it('returns 500 when service throws', async () => {
      fxService.getCurrentRatesMock.mockRejectedValue(new Error('Provider down'));

      const res = await request(app).get('/fx/rates');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /fx/quote ─────────────────────────────────────────────────────────

  describe('POST /fx/quote', () => {
    const validBody = {
      from_currency: 'USD',
      to_currency: 'NGN',
      amount: 100,
      direction: 'send',
    };

    it('returns 201 with a quote when input is valid', async () => {
      fxService.createQuoteMock.mockResolvedValue(makeQuote());

      const res = await request(app).post('/fx/quote').send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('quote-abc-123');
      expect(res.body.data.customerRate).toBe(1542.8);
      expect(res.body.data.fee).toBe(2.00);
      expect(res.body.data.expiresAt).toBeDefined();
    });

    it('calls service with correctly mapped input', async () => {
      fxService.createQuoteMock.mockResolvedValue(makeQuote());

      await request(app).post('/fx/quote').send(validBody);

      expect(fxService.createQuoteMock).toHaveBeenCalledWith({
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        amount: 100,
        direction: 'send',
      });
    });

    it('returns 400 when from_currency is missing', async () => {
      const res = await request(app)
        .post('/fx/quote')
        .send({ to_currency: 'NGN', amount: 100, direction: 'send' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when to_currency is missing', async () => {
      const res = await request(app)
        .post('/fx/quote')
        .send({ from_currency: 'USD', amount: 100, direction: 'send' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when amount is not a positive number', async () => {
      const res = await request(app)
        .post('/fx/quote')
        .send({ ...validBody, amount: -5 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when amount is zero', async () => {
      const res = await request(app)
        .post('/fx/quote')
        .send({ ...validBody, amount: 0 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when direction is invalid', async () => {
      const res = await request(app)
        .post('/fx/quote')
        .send({ ...validBody, direction: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for unsupported corridor (service throws)', async () => {
      fxService.createQuoteMock.mockRejectedValue(new Error('Unsupported corridor: USD/XYZ'));

      const res = await request(app)
        .post('/fx/quote')
        .send({ ...validBody, to_currency: 'XYZ' });

      expect(res.status).toBe(400);
    });

    it('returns 500 for unexpected service errors', async () => {
      fxService.createQuoteMock.mockRejectedValue(new Error('Database error'));

      const res = await request(app).post('/fx/quote').send(validBody);

      expect(res.status).toBe(500);
    });
  });

  // ── POST /fx/quote/:id/lock ────────────────────────────────────────────────

  describe('POST /fx/quote/:id/lock', () => {
    it('returns 200 with the locked quote', async () => {
      const lockedQuote = makeQuote({ usedAt: new Date() });
      fxService.validateAndLockQuoteMock.mockResolvedValue(lockedQuote);

      const res = await request(app).post('/fx/quote/quote-abc-123/lock');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.usedAt).toBeDefined();
      expect(fxService.validateAndLockQuoteMock).toHaveBeenCalledWith('quote-abc-123');
    });

    it('returns 404 when quote not found', async () => {
      fxService.validateAndLockQuoteMock.mockRejectedValue(new Error('Quote not found: xyz'));

      const res = await request(app).post('/fx/quote/xyz/lock');

      expect(res.status).toBe(404);
    });

    it('returns 409 when quote already used', async () => {
      fxService.validateAndLockQuoteMock.mockRejectedValue(new Error('already used'));

      const res = await request(app).post('/fx/quote/quote-abc-123/lock');

      expect(res.status).toBe(409);
    });

    it('returns 410 when quote has expired', async () => {
      fxService.validateAndLockQuoteMock.mockRejectedValue(new Error('Quote xyz has expired'));

      const res = await request(app).post('/fx/quote/xyz/lock');

      expect(res.status).toBe(410);
    });
  });
});
