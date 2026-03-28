/**
 * Admin Routes — TDD RED phase.
 *
 * Tests for:
 *  - requireAdmin middleware
 *  - GET /v1/admin/transactions  (list all, filter)
 *  - GET /v1/admin/transactions/:id
 *  - POST /v1/admin/transactions/:id/override  (status override)
 *  - GET /v1/admin/users  (list all users)
 *  - PATCH /v1/admin/users/:id  (update KYC tier, account status)
 *  - GET /v1/admin/fx/corridors  (list corridors with rates/markup)
 *  - PATCH /v1/admin/fx/corridors/:id  (update markup)
 *  - GET /v1/admin/compliance  (flagged transactions)
 *  - GET /v1/admin/metrics/corridors  (corridor performance)
 */

import request from 'supertest';
import express from 'express';
import { createAdminRouter } from '../src/routes/admin';
import { createRequireAdmin } from '../src/middleware/requireAdmin';
import { JwtService } from '../src/services/jwtService';
import type { IAdminService } from '../src/services/adminService';

// ── Helpers ──────────────────────────────────────────────────────────────────

let jwtService: JwtService;
let adminToken: string;
let userToken: string;

async function makeTokens() {
  jwtService = new JwtService();
  adminToken = await jwtService.signAccessToken({ userId: 'admin-1', email: 'admin@afrisend.com', isAdmin: true });
  userToken = await jwtService.signAccessToken({ userId: 'user-1', email: 'user@example.com' });
}

function buildMockAdminService(overrides: Partial<IAdminService> = {}): IAdminService {
  return {
    listTransactions: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    getTransaction: jest.fn().mockResolvedValue(null),
    overrideTransactionStatus: jest.fn().mockResolvedValue(null),
    listUsers: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    updateUser: jest.fn().mockResolvedValue(null),
    listFxCorridors: jest.fn().mockResolvedValue([]),
    updateCorridorMarkup: jest.fn().mockResolvedValue(null),
    listFlaggedTransactions: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    getCorridorMetrics: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildApp(adminService: IAdminService) {
  const app = express();
  app.use(express.json());
  const requireAdmin = createRequireAdmin(jwtService);
  app.use('/v1/admin', requireAdmin, createAdminRouter(adminService));
  return app;
}

// ── requireAdmin middleware ───────────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  beforeAll(makeTokens);

  it('rejects requests with no auth header', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app).get('/v1/admin/transactions');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin tokens', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .get('/v1/admin/transactions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin tokens through', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .get('/v1/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ── GET /admin/transactions ───────────────────────────────────────────────────

describe('GET /admin/transactions', () => {
  beforeAll(makeTokens);

  it('returns paginated transactions', async () => {
    const mockTx = {
      id: 'tx-1',
      userId: 'user-1',
      amount: 100,
      currency: 'GBP',
      targetAmount: 150000,
      targetCurrency: 'NGN',
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    const svc = buildMockAdminService({
      listTransactions: jest.fn().mockResolvedValue({ data: [mockTx], total: 1, page: 1, limit: 20 }),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('passes status filter to service', async () => {
    const svc = buildMockAdminService();
    const app = buildApp(svc);

    await request(app)
      .get('/v1/admin/transactions?status=pending&page=2&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(svc.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', page: 2, limit: 5 }),
    );
  });

  it('passes userId filter to service', async () => {
    const svc = buildMockAdminService();
    const app = buildApp(svc);

    await request(app)
      .get('/v1/admin/transactions?userId=user-99')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(svc.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-99' }),
    );
  });
});

// ── GET /admin/transactions/:id ───────────────────────────────────────────────

describe('GET /admin/transactions/:id', () => {
  beforeAll(makeTokens);

  it('returns a transaction by id', async () => {
    const mockTx = { id: 'tx-1', status: 'pending' };
    const svc = buildMockAdminService({
      getTransaction: jest.fn().mockResolvedValue(mockTx),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/transactions/tx-1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('tx-1');
  });

  it('returns 404 when not found', async () => {
    const svc = buildMockAdminService({
      getTransaction: jest.fn().mockRejectedValue(new Error('Transaction not found')),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/transactions/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /admin/transactions/:id/override ─────────────────────────────────────

describe('POST /admin/transactions/:id/override', () => {
  beforeAll(makeTokens);

  it('overrides transaction status', async () => {
    const updated = { id: 'tx-1', status: 'completed' };
    const svc = buildMockAdminService({
      overrideTransactionStatus: jest.fn().mockResolvedValue(updated),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .post('/v1/admin/transactions/tx-1/override')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed', reason: 'Manual override by admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(svc.overrideTransactionStatus).toHaveBeenCalledWith(
      'tx-1',
      'completed',
      'Manual override by admin',
      'admin-1',
    );
  });

  it('rejects missing status', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .post('/v1/admin/transactions/tx-1/override')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'no status' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid status', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .post('/v1/admin/transactions/tx-1/override')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid_status', reason: 'bad' });

    expect(res.status).toBe(400);
  });
});

// ── GET /admin/users ──────────────────────────────────────────────────────────

describe('GET /admin/users', () => {
  beforeAll(makeTokens);

  it('returns paginated users', async () => {
    const mockUser = { id: 'user-1', email: 'a@b.com', kycTier: 1, kycStatus: 'approved' };
    const svc = buildMockAdminService({
      listUsers: jest.fn().mockResolvedValue({ data: [mockUser], total: 1, page: 1, limit: 20 }),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('passes kycStatus filter to service', async () => {
    const svc = buildMockAdminService();
    const app = buildApp(svc);

    await request(app)
      .get('/v1/admin/users?kycStatus=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(svc.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ kycStatus: 'pending' }),
    );
  });
});

// ── PATCH /admin/users/:id ────────────────────────────────────────────────────

describe('PATCH /admin/users/:id', () => {
  beforeAll(makeTokens);

  it('updates user KYC tier', async () => {
    const updated = { id: 'user-1', kycTier: 2 };
    const svc = buildMockAdminService({
      updateUser: jest.fn().mockResolvedValue(updated),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .patch('/v1/admin/users/user-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kycTier: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.kycTier).toBe(2);
  });

  it('updates account status', async () => {
    const updated = { id: 'user-1', accountStatus: 'suspended' };
    const svc = buildMockAdminService({
      updateUser: jest.fn().mockResolvedValue(updated),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .patch('/v1/admin/users/user-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accountStatus: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.data.accountStatus).toBe('suspended');
  });

  it('rejects invalid accountStatus', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .patch('/v1/admin/users/user-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accountStatus: 'banana' });

    expect(res.status).toBe(400);
  });
});

// ── GET /admin/fx/corridors ───────────────────────────────────────────────────

describe('GET /admin/fx/corridors', () => {
  beforeAll(makeTokens);

  it('returns corridors with markup', async () => {
    const corridors = [
      { id: 'c-1', fromCurrency: 'GBP', toCurrency: 'NGN', markupBps: 150 },
    ];
    const svc = buildMockAdminService({
      listFxCorridors: jest.fn().mockResolvedValue(corridors),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/fx/corridors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].markupBps).toBe(150);
  });
});

// ── PATCH /admin/fx/corridors/:id ─────────────────────────────────────────────

describe('PATCH /admin/fx/corridors/:id', () => {
  beforeAll(makeTokens);

  it('updates corridor markup', async () => {
    const updated = { id: 'c-1', markupBps: 200 };
    const svc = buildMockAdminService({
      updateCorridorMarkup: jest.fn().mockResolvedValue(updated),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .patch('/v1/admin/fx/corridors/c-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ markupBps: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.markupBps).toBe(200);
    expect(svc.updateCorridorMarkup).toHaveBeenCalledWith('c-1', 200);
  });

  it('rejects non-numeric markupBps', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .patch('/v1/admin/fx/corridors/c-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ markupBps: 'high' });

    expect(res.status).toBe(400);
  });

  it('rejects negative markupBps', async () => {
    const app = buildApp(buildMockAdminService());
    const res = await request(app)
      .patch('/v1/admin/fx/corridors/c-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ markupBps: -10 });

    expect(res.status).toBe(400);
  });
});

// ── GET /admin/compliance ─────────────────────────────────────────────────────

describe('GET /admin/compliance', () => {
  beforeAll(makeTokens);

  it('returns flagged transactions', async () => {
    const flagged = [
      { id: 'tx-2', flagReason: 'aml_alert', flaggedAt: new Date().toISOString() },
    ];
    const svc = buildMockAdminService({
      listFlaggedTransactions: jest.fn().mockResolvedValue({ data: flagged, total: 1, page: 1, limit: 20 }),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].flagReason).toBe('aml_alert');
  });

  it('passes flag type filter to service', async () => {
    const svc = buildMockAdminService();
    const app = buildApp(svc);

    await request(app)
      .get('/v1/admin/compliance?flagType=sanctions_hit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(svc.listFlaggedTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ flagType: 'sanctions_hit' }),
    );
  });
});

// ── GET /admin/metrics/corridors ──────────────────────────────────────────────

describe('GET /admin/metrics/corridors', () => {
  beforeAll(makeTokens);

  it('returns corridor performance metrics', async () => {
    const metrics = [
      {
        corridorId: 'c-1',
        fromCurrency: 'GBP',
        toCurrency: 'NGN',
        totalVolume: 50000,
        transactionCount: 250,
        successRate: 0.97,
        avgProcessingTimeSec: 42,
      },
    ];
    const svc = buildMockAdminService({
      getCorridorMetrics: jest.fn().mockResolvedValue(metrics),
    });
    const app = buildApp(svc);

    const res = await request(app)
      .get('/v1/admin/metrics/corridors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].successRate).toBe(0.97);
  });
});
