jest.mock('@/lib/auth/cookies', () => ({
  getAccessToken: jest.fn().mockReturnValue(null),
  setAccessToken: jest.fn(),
  getRefreshToken: jest.fn().mockReturnValue(null),
  clearAuthTokens: jest.fn(),
}));

jest.mock('@/lib/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

import * as client from '@/lib/api/client';
import { register, login, verifyOtp, getMe, refreshToken } from '@/lib/api/auth';

const mockUser = {
  id: 'u-1',
  email: 'test@example.com',
  phone: '+44123456789',
  firstName: 'Test',
  lastName: 'User',
  kycStatus: 'approved' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('auth API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should call POST /auth/register', async () => {
      (client.post as jest.Mock).mockResolvedValue({ message: 'Check your email' });
      const data = {
        email: 'test@example.com',
        phone: '+44123456789',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
      };
      const result = await register(data);
      expect(client.post).toHaveBeenCalledWith('/auth/register', data);
      expect(result.message).toBe('Check your email');
    });
  });

  describe('login', () => {
    it('should call POST /auth/login and return requiresMfa=true', async () => {
      (client.post as jest.Mock).mockResolvedValue({ requiresMfa: true, sessionId: 'sess-1' });
      const result = await login({ email: 'test@example.com', password: 'password123' });
      expect(client.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.requiresMfa).toBe(true);
      expect(result.sessionId).toBe('sess-1');
    });

    it('should return tokens when MFA not required', async () => {
      const tokens = { accessToken: 'at-1', refreshToken: 'rt-1' };
      (client.post as jest.Mock).mockResolvedValue({ requiresMfa: false, tokens, user: mockUser });
      const result = await login({ email: 'test@example.com', password: 'password123' });
      expect(result.tokens).toEqual(tokens);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('verifyOtp', () => {
    it('should call POST /auth/verify-otp', async () => {
      const tokens = { accessToken: 'at-1', refreshToken: 'rt-1' };
      (client.post as jest.Mock).mockResolvedValue({ tokens, user: mockUser });
      const result = await verifyOtp({ sessionId: 'sess-1', otp: '123456' });
      expect(client.post).toHaveBeenCalledWith('/auth/verify-otp', { sessionId: 'sess-1', otp: '123456' });
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('getMe', () => {
    it('should call GET /users/me', async () => {
      (client.get as jest.Mock).mockResolvedValue(mockUser);
      const result = await getMe();
      expect(client.get).toHaveBeenCalledWith('/users/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('refreshToken', () => {
    it('should call POST /auth/refresh', async () => {
      (client.post as jest.Mock).mockResolvedValue({ accessToken: 'new-at' });
      const result = await refreshToken('rt-1');
      expect(client.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'rt-1' });
      expect(result.accessToken).toBe('new-at');
    });
  });
});
