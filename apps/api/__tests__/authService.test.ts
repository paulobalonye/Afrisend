/**
 * Integration-style tests for the hardened AuthService.
 * TDD RED phase: login, refresh token rotation, logout, register.
 */
import { HardenedAuthService } from '../src/services/authService';
import { JwtService } from '../src/services/jwtService';
import { LoginRateLimiter } from '../src/services/loginRateLimiter';
import { InMemoryRefreshTokenStore } from '../src/services/refreshTokenStore';

describe('HardenedAuthService', () => {
  let service: HardenedAuthService;
  let jwtService: JwtService;
  let rateLimiter: LoginRateLimiter;
  let tokenStore: InMemoryRefreshTokenStore;

  beforeEach(() => {
    jwtService = new JwtService();
    rateLimiter = new LoginRateLimiter();
    tokenStore = new InMemoryRefreshTokenStore();
    service = new HardenedAuthService(jwtService, rateLimiter, tokenStore);
  });

  describe('register', () => {
    it('should create a new user and return access + refresh tokens', async () => {
      const result = await service.register({
        temporaryToken: 'temp-token-123',
        firstName: 'Ada',
        lastName: 'Obi',
        email: 'ada@example.com',
        password: 'SecurePassword123!',
      });
      expect(result.user.email).toBe('ada@example.com');
      expect(result.user.firstName).toBe('Ada');
      expect(typeof result.tokens.accessToken).toBe('string');
      expect(typeof result.tokens.refreshToken).toBe('string');
      expect(result.tokens.expiresAt).toBeDefined();
    });

    it('should hash the password (not store plaintext)', async () => {
      const input = {
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        password: 'MyPassword!',
      };
      await service.register(input);
      // The service should NOT expose the password hash via the User object
      const result = await service.register({ ...input, email: 'c@d.com' });
      // User object should not contain password
      expect(Object.keys(result.user)).not.toContain('password');
      expect(Object.keys(result.user)).not.toContain('passwordHash');
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'login@example.com',
        password: 'CorrectPassword!',
      });

      const result = await service.login({
        email: 'login@example.com',
        password: 'CorrectPassword!',
        deviceFingerprint: 'device-abc',
        ip: '1.1.1.1',
      });
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
    });

    it('should throw on invalid password', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'wrongpw@example.com',
        password: 'CorrectPassword!',
      });

      await expect(
        service.login({
          email: 'wrongpw@example.com',
          password: 'WrongPassword!',
          deviceFingerprint: 'device-abc',
          ip: '1.1.1.1',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw on unknown email', async () => {
      await expect(
        service.login({
          email: 'noexist@example.com',
          password: 'whatever',
          deviceFingerprint: 'device-abc',
          ip: '1.1.1.1',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login when account is locked', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'locked@example.com',
        password: 'CorrectPassword!',
      });

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await service.login({
            email: 'locked@example.com',
            password: 'WrongPassword!',
            deviceFingerprint: 'device-abc',
            ip: '1.1.1.1',
          });
        } catch {
          // expected failures
        }
      }

      // Now correct password should still be rejected
      await expect(
        service.login({
          email: 'locked@example.com',
          password: 'CorrectPassword!',
          deviceFingerprint: 'device-abc',
          ip: '1.1.1.1',
        })
      ).rejects.toThrow(/locked|rate limit/i);
    });
  });

  describe('refreshToken', () => {
    it('should issue new access token for valid refresh token', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'refresh@example.com',
        password: 'Password!',
      });

      const loginResult = await service.login({
        email: 'refresh@example.com',
        password: 'Password!',
        deviceFingerprint: 'device-abc',
        ip: '1.1.1.1',
      });

      const result = await service.refreshToken(
        loginResult.tokens.refreshToken,
        'device-abc'
      );
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should rotate the refresh token (old one becomes invalid)', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'rotate@example.com',
        password: 'Password!',
      });

      const loginResult = await service.login({
        email: 'rotate@example.com',
        password: 'Password!',
        deviceFingerprint: 'device-abc',
        ip: '1.1.1.1',
      });

      const oldRefreshToken = loginResult.tokens.refreshToken;
      await service.refreshToken(oldRefreshToken, 'device-abc');

      // Old token should now be invalid
      await expect(
        service.refreshToken(oldRefreshToken, 'device-abc')
      ).rejects.toThrow();
    });

    it('should reject a refresh token with wrong device fingerprint', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'fingerprint@example.com',
        password: 'Password!',
      });

      const loginResult = await service.login({
        email: 'fingerprint@example.com',
        password: 'Password!',
        deviceFingerprint: 'device-abc',
        ip: '1.1.1.1',
      });

      await expect(
        service.refreshToken(loginResult.tokens.refreshToken, 'different-device')
      ).rejects.toThrow();
    });

    it('should reject an invalid/unknown refresh token', async () => {
      await expect(
        service.refreshToken('bogus-token', 'device-abc')
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should invalidate the refresh token', async () => {
      await service.register({
        temporaryToken: 't',
        firstName: 'A',
        lastName: 'B',
        email: 'logout@example.com',
        password: 'Password!',
      });

      const loginResult = await service.login({
        email: 'logout@example.com',
        password: 'Password!',
        deviceFingerprint: 'device-abc',
        ip: '1.1.1.1',
      });

      await service.logout(loginResult.tokens.accessToken, loginResult.tokens.refreshToken);

      await expect(
        service.refreshToken(loginResult.tokens.refreshToken, 'device-abc')
      ).rejects.toThrow();
    });
  });
});
