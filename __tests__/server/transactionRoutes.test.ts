/**
 * Integration tests for transaction HTTP routes.
 * Tests the full HTTP layer with a mock TransactionService.
 */

import request from 'supertest';
import express from 'express';
import { createTransactionRouter } from '@/server/routes/transactions';
import type { ITransactionService } from '@/server/services/transactionService';
import { TransactionStatus } from '@/server/services/transactionService';
import { globalErrorHandler } from '@/server/middleware/errorHandler';
import { requireAuth } from '@/server/middleware/requireAuth';

// ─── Mock service ─────────────────────────────────────────────────────────────

const mockTx = {
  id: 'tx-001',
  userId: 'user-from-test-token',
  recipientId: 'rec-001',
  idempotencyKey: 'idem-001',
  amount: 100,
  currency: 'USDC',
  targetAmount: 75000,
  targetCurrency: 'NGN',
  fxRate: 750,
  status: TransactionStatus.Pending,
  payoutRail: 'yellowcard',
  payoutReference: null,
  retryCount: 0,
  failureReason: null,
  quoteId: 'quote-001',
  corridorId: 'cor-ng',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

function buildMockService(overrides: Partial<ITransactionService> = {}): ITransactionService {
  return {
    initiate: jest.fn().mockResolvedValue(mockTx),
    get: jest.fn().mockResolvedValue(mockTx),
    list: jest.fn().mockResolvedValue({ data: [mockTx], total: 1, page: 1, limit: 10 }),
    cancel: jest.fn().mockResolvedValue({ ...mockTx, status: TransactionStatus.Cancelled }),
    transitionTo: jest.fn().mockResolvedValue(mockTx),
    getEvents: jest.fn().mockResolvedValue([]),
    retry: jest.fn().mockResolvedValue({ ...mockTx, retryCount: 1 }),
    ...overrides,
  };
}

function buildApp(service: ITransactionService) {
  const app = express();
  app.use(express.json());
  app.use('/v1/transactions', requireAuth, createTransactionRouter(service));
  app.use(globalErrorHandler);
  return app;
}

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

// ─── POST /v1/transactions ────────────────────────────────────────────────────

describe('POST /v1/transactions', () => {
  const validBody = {
    idempotencyKey: 'idem-001',
    recipientId: 'rec-001',
    amount: 100,
    currency: 'USDC',
    targetAmount: 75000,
    targetCurrency: 'NGN',
    fxRate: 750,
    payoutRail: 'yellowcard',
    quoteId: 'quote-001',
    corridorId: 'cor-ng',
  };

  it('creates a transaction and returns 201', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions').set(AUTH_HEADER).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('tx-001');
  });

  it('returns 400 when idempotencyKey is missing', async () => {
    const app = buildApp(buildMockService());
    const { idempotencyKey: _omit, ...body } = validBody;
    const res = await request(app).post('/v1/transactions').set(AUTH_HEADER).send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is missing', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions').set(AUTH_HEADER).send({ ...validBody, amount: undefined });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is not positive', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions').set(AUTH_HEADER).send({ ...validBody, amount: -1 });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth header', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions').send(validBody);

    expect(res.status).toBe(401);
  });

  it('passes userId from auth to service', async () => {
    const mockService = buildMockService();
    const app = buildApp(mockService);
    await request(app).post('/v1/transactions').set(AUTH_HEADER).send(validBody);

    expect(mockService.initiate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-from-test-token' })
    );
  });
});

// ─── GET /v1/transactions/:id ─────────────────────────────────────────────────

describe('GET /v1/transactions/:id', () => {
  it('returns 200 with transaction data', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).get('/v1/transactions/tx-001').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('tx-001');
  });

  it('returns 404 when service throws not-found', async () => {
    const app = buildApp(buildMockService({
      get: jest.fn().mockRejectedValue(new Error('transaction not found')),
    }));
    const res = await request(app).get('/v1/transactions/bad-id').set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth header', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).get('/v1/transactions/tx-001');

    expect(res.status).toBe(401);
  });
});

// ─── GET /v1/transactions ─────────────────────────────────────────────────────

describe('GET /v1/transactions', () => {
  it('returns paginated list with 200', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).get('/v1/transactions').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBe(1);
  });

  it('accepts page and limit query params', async () => {
    const mockService = buildMockService();
    const app = buildApp(mockService);
    await request(app).get('/v1/transactions?page=2&limit=5').set(AUTH_HEADER);

    expect(mockService.list).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ page: 2, limit: 5 })
    );
  });

  it('defaults page=1 and limit=10 when not provided', async () => {
    const mockService = buildMockService();
    const app = buildApp(mockService);
    await request(app).get('/v1/transactions').set(AUTH_HEADER);

    expect(mockService.list).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ page: 1, limit: 10 })
    );
  });

  it('returns 401 without auth header', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).get('/v1/transactions');

    expect(res.status).toBe(401);
  });
});

// ─── POST /v1/transactions/:id/cancel ─────────────────────────────────────────

describe('POST /v1/transactions/:id/cancel', () => {
  it('cancels a pending transaction and returns 200', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions/tx-001/cancel').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(TransactionStatus.Cancelled);
  });

  it('returns 404 when transaction not found', async () => {
    const app = buildApp(buildMockService({
      cancel: jest.fn().mockRejectedValue(new Error('transaction not found')),
    }));
    const res = await request(app).post('/v1/transactions/bad-id/cancel').set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('returns 409 when transaction cannot be cancelled', async () => {
    const app = buildApp(buildMockService({
      cancel: jest.fn().mockRejectedValue(new Error('cannot cancel a processing transaction')),
    }));
    const res = await request(app).post('/v1/transactions/tx-001/cancel').set(AUTH_HEADER);

    expect(res.status).toBe(409);
  });

  it('returns 401 without auth header', async () => {
    const app = buildApp(buildMockService());
    const res = await request(app).post('/v1/transactions/tx-001/cancel');

    expect(res.status).toBe(401);
  });
});
