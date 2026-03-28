import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearAuthTokens,
} from '@/lib/auth/cookies';

describe('cookie helpers', () => {
  beforeEach(() => {
    // Clear document.cookie between tests
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
  });

  it('should set and get access token', () => {
    setAccessToken('access-abc');
    expect(getAccessToken()).toBe('access-abc');
  });

  it('should set and get refresh token', () => {
    setRefreshToken('refresh-xyz');
    expect(getRefreshToken()).toBe('refresh-xyz');
  });

  it('should return null when no access token', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('should return null when no refresh token', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('should clear both tokens', () => {
    setAccessToken('access-abc');
    setRefreshToken('refresh-xyz');
    clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
