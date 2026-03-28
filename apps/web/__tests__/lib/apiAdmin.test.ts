/**
 * Admin API client — TDD RED phase.
 */

import {
  listAdminTransactions,
  getAdminTransaction,
  overrideTransactionStatus,
  listAdminUsers,
  updateAdminUser,
  listFxCorridors,
  updateCorridorMarkup,
  listFlaggedTransactions,
  getCorridorMetrics,
} from '@/lib/api/admin';

jest.mock('@/lib/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

import { get, post, patch } from '@/lib/api/client';

const mockGet = get as jest.Mock;
const mockPost = post as jest.Mock;
const mockPatch = patch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listAdminTransactions', () => {
  it('calls GET /admin/transactions with default params', async () => {
    mockGet.mockResolvedValue([]);
    await listAdminTransactions();
    expect(mockGet).toHaveBeenCalledWith('/admin/transactions', expect.objectContaining({ params: expect.any(Object) }));
  });

  it('forwards status and page filters', async () => {
    mockGet.mockResolvedValue([]);
    await listAdminTransactions({ status: 'pending', page: 2, limit: 5 });
    const callParams = mockGet.mock.calls[0][1]?.params;
    expect(callParams.status).toBe('pending');
    expect(callParams.page).toBe(2);
    expect(callParams.limit).toBe(5);
  });
});

describe('getAdminTransaction', () => {
  it('calls GET /admin/transactions/:id', async () => {
    mockGet.mockResolvedValue({ id: 'tx-1' });
    const result = await getAdminTransaction('tx-1');
    expect(result.id).toBe('tx-1');
    expect(mockGet).toHaveBeenCalledWith('/admin/transactions/tx-1');
  });
});

describe('overrideTransactionStatus', () => {
  it('calls POST /admin/transactions/:id/override', async () => {
    mockPost.mockResolvedValue({ id: 'tx-1', status: 'completed' });
    const result = await overrideTransactionStatus('tx-1', 'completed', 'test override');
    expect(result.status).toBe('completed');
    expect(mockPost).toHaveBeenCalledWith('/admin/transactions/tx-1/override', {
      status: 'completed',
      reason: 'test override',
    });
  });
});

describe('listAdminUsers', () => {
  it('calls GET /admin/users', async () => {
    mockGet.mockResolvedValue([]);
    await listAdminUsers();
    expect(mockGet).toHaveBeenCalledWith('/admin/users', expect.any(Object));
  });

  it('forwards kycStatus filter', async () => {
    mockGet.mockResolvedValue([]);
    await listAdminUsers({ kycStatus: 'pending' });
    const callParams = mockGet.mock.calls[0][1]?.params;
    expect(callParams.kycStatus).toBe('pending');
  });
});

describe('updateAdminUser', () => {
  it('calls PATCH /admin/users/:id', async () => {
    mockPatch.mockResolvedValue({ id: 'user-1', kycTier: 2 });
    const result = await updateAdminUser('user-1', { kycTier: 2 });
    expect(result.kycTier).toBe(2);
    expect(mockPatch).toHaveBeenCalledWith('/admin/users/user-1', { kycTier: 2 });
  });
});

describe('listFxCorridors', () => {
  it('calls GET /admin/fx/corridors', async () => {
    mockGet.mockResolvedValue([]);
    await listFxCorridors();
    expect(mockGet).toHaveBeenCalledWith('/admin/fx/corridors');
  });
});

describe('updateCorridorMarkup', () => {
  it('calls PATCH /admin/fx/corridors/:id', async () => {
    mockPatch.mockResolvedValue({ id: 'c-1', markupBps: 200 });
    const result = await updateCorridorMarkup('c-1', 200);
    expect(result.markupBps).toBe(200);
    expect(mockPatch).toHaveBeenCalledWith('/admin/fx/corridors/c-1', { markupBps: 200 });
  });
});

describe('listFlaggedTransactions', () => {
  it('calls GET /admin/compliance', async () => {
    mockGet.mockResolvedValue([]);
    await listFlaggedTransactions();
    expect(mockGet).toHaveBeenCalledWith('/admin/compliance', expect.any(Object));
  });

  it('forwards flagType filter', async () => {
    mockGet.mockResolvedValue([]);
    await listFlaggedTransactions({ flagType: 'aml_alert' });
    const callParams = mockGet.mock.calls[0][1]?.params;
    expect(callParams.flagType).toBe('aml_alert');
  });
});

describe('getCorridorMetrics', () => {
  it('calls GET /admin/metrics/corridors', async () => {
    mockGet.mockResolvedValue([]);
    await getCorridorMetrics();
    expect(mockGet).toHaveBeenCalledWith('/admin/metrics/corridors');
  });
});
