jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn().mockReturnValue('test-token'),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  clearAuthTokens: jest.fn(),
}));

// Avoid closure-over-variable issue by using jest.fn() inside the factory
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    default: {
      create: jest.fn(() => mockInstance),
    },
    create: jest.fn(() => mockInstance),
  };
});

import axios from 'axios';
import { get, post, patch, del, ApiError } from '@/lib/api/client';

// Get the mock instance that was created when the module loaded
const mockInstance = (axios.create as jest.Mock).mock.results[0]?.value;

describe('HTTP wrapper functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get()', () => {
    it('should return data on successful response', async () => {
      mockInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: { id: 'x' }, error: null },
      });
      const result = await get<{ id: string }>('/test');
      expect(result).toEqual({ id: 'x' });
    });

    it('should throw ApiError when success=false', async () => {
      mockInstance.get.mockResolvedValue({
        status: 400,
        data: { success: false, data: null, error: 'Bad request' },
      });
      await expect(get('/test')).rejects.toBeInstanceOf(ApiError);
    });

    it('should use fallback message when error field is null', async () => {
      mockInstance.get.mockResolvedValue({
        status: 500,
        data: { success: false, data: null, error: null },
      });
      await expect(get('/test')).rejects.toThrow('Request failed');
    });
  });

  describe('post()', () => {
    it('should return data on success', async () => {
      mockInstance.post.mockResolvedValue({
        status: 201,
        data: { success: true, data: { created: true }, error: null },
      });
      const result = await post('/test', { name: 'foo' });
      expect(result).toEqual({ created: true });
    });

    it('should throw when data is null', async () => {
      mockInstance.post.mockResolvedValue({
        status: 409,
        data: { success: false, data: null, error: 'Conflict' },
      });
      await expect(post('/test')).rejects.toThrow('Conflict');
    });
  });

  describe('patch()', () => {
    it('should return updated data', async () => {
      mockInstance.patch.mockResolvedValue({
        status: 200,
        data: { success: true, data: { updated: true }, error: null },
      });
      const result = await patch('/test', {});
      expect(result).toEqual({ updated: true });
    });

    it('should throw on error', async () => {
      mockInstance.patch.mockResolvedValue({
        status: 422,
        data: { success: false, data: null, error: 'Validation error' },
      });
      await expect(patch('/test', {})).rejects.toThrow('Validation error');
    });
  });

  describe('del()', () => {
    it('should return null data when success=true', async () => {
      mockInstance.delete.mockResolvedValue({
        status: 204,
        data: { success: true, data: null, error: null },
      });
      const result = await del('/test');
      expect(result).toBeNull();
    });

    it('should throw when success=false', async () => {
      mockInstance.delete.mockResolvedValue({
        status: 404,
        data: { success: false, data: null, error: 'Not found' },
      });
      await expect(del('/test')).rejects.toThrow('Not found');
    });
  });
});
