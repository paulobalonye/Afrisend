import { ApiError, createApiClient } from '@/lib/api/client';

// Mock cookies module
jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn().mockReturnValue(null),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn().mockReturnValue(null),
  clearAuthTokens: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  const mockAxios = {
    create: jest.fn(() => mockAxiosInstance),
  };
  return { default: mockAxios, ...mockAxios };
});

import axios from 'axios';

describe('ApiError', () => {
  it('should create error with statusCode and message', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('ApiError');
  });

  it('should include optional code', () => {
    const err = new ApiError(401, 'Unauthorized', 'SESSION_EXPIRED');
    expect(err.code).toBe('SESSION_EXPIRED');
  });
});

describe('createApiClient', () => {
  it('should call axios.create with correct base URL', () => {
    createApiClient('http://test.example.com/v1');
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://test.example.com/v1',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('should register request and response interceptors', () => {
    const instance = createApiClient('http://test.example.com/v1');
    expect(instance.interceptors.request.use).toHaveBeenCalled();
    expect(instance.interceptors.response.use).toHaveBeenCalled();
  });
});
