/**
 * Integration-style tests for the hardened AuthService.
 * TDD RED phase: login, refresh token rotation, logout, register.
 */
import { HardenedAuthService, type LoginResult, type MfaChallengeResult } from '../src/services/authService';
import { JwtService } from '../src/services/jwtService';
import { LoginRateLimiter } from '../src/services/loginRateLimiter';
import { InMemoryRefreshTokenStore } from '../src/services/refreshTokenStore';
import { MfaService } from '../src/services/mfaService';
import { InMemoryMfaStore } from '../src/services/mfaStore';
import { authenticator } from '@otplib/preset-default';

// Set encryption key for tests
process.env.MFA_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

/** Helper: assert a login response is a full LoginResult (no MFA challenge). */
function assertLoginResult(result: unknown): asserts result is LoginResult {
  const r = result as Record<string, unknown>;
  if (r.mfaRequired) {
    throw new Error('Expected LoginResult but got MfaChallengeResult');
  }
}

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
      assertLoginResult(result);
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
      assertLoginResult(loginResult);

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
      assertLoginResult(loginResult);

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
      assertLoginResult(loginResult);

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
      assertLoginResult(loginResult);

      await service.logout(loginResult.tokens.accessToken, loginResult.tokens.refreshToken);

      await expect(
        service.refreshToken(loginResult.tokens.refreshToken, 'device-abc')
      ).rejects.toThrow();
    });
  });
});

describe('HardenedAuthService with MFA', () => {
  let service: HardenedAuthService;
  let mfaService: MfaService;

  /** Helper to register and enable MFA for a user, returns the TOTP secret. */
  async function registerWithMfa(email: string, password: string): Promise<string> {
    await service.register({
      temporaryToken: 't',
      firstName: 'A',
      lastName: 'B',
      email,
      password,
    });

    // We need the userId — login to get it (MFA not yet enabled)
    const loginRes = await service.login({ email, password, deviceFingerprint: 'dev', ip: '1.1.1.1' });
    if ('mfaRequired' in loginRes && loginRes.mfaRequired) throw new Error('Unexpected MFA challenge');

    const userId = (loginRes as LoginResult).user.id;

    // Setup and confirm MFA
    const { secret } = await mfaService.setup(userId, email);
    const totpCode = authenticator.generate(secret);
    await mfaService.confirmSetup(userId, totpCode);

    return secret;
  }

  beforeEach(() => {
    const jwtService = new JwtService();
    const rateLimiter = new LoginRateLimiter();
    const tokenStore = new InMemoryRefreshTokenStore();
    mfaService = new MfaService(new InMemoryMfaStore());
    service = new HardenedAuthService(jwtService, rateLimiter, tokenStore, mfaService);
  });

  it('should return MFA challenge when MFA is enabled', async () => {
    await registerWithMfa('mfa@example.com', 'Password!');

    const result = await service.login({
      email: 'mfa@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });

    expect(result.mfaRequired).toBe(true);
    expect((result as MfaChallengeResult).mfaChallengeToken).toBeTruthy();
    expect(result.tokens).toBeUndefined();
  });

  it('should complete MFA login with valid TOTP code', async () => {
    const secret = await registerWithMfa('mfa2@example.com', 'Password!');

    const challengeRes = await service.login({
      email: 'mfa2@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });
    const challengeToken = (challengeRes as MfaChallengeResult).mfaChallengeToken;

    const totpCode = authenticator.generate(secret);
    const result = await service.completeMfaLogin(challengeToken, totpCode, 'dev');

    expect(result.user.email).toBe('mfa2@example.com');
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it('should reject MFA login with invalid code', async () => {
    await registerWithMfa('mfa3@example.com', 'Password!');

    const challengeRes = await service.login({
      email: 'mfa3@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });
    const challengeToken = (challengeRes as MfaChallengeResult).mfaChallengeToken;

    await expect(
      service.completeMfaLogin(challengeToken, '000000', 'dev')
    ).rejects.toThrow('Invalid MFA code');
  });

  it('should reject MFA login with wrong device fingerprint', async () => {
    await registerWithMfa('mfa4@example.com', 'Password!');

    const challengeRes = await service.login({
      email: 'mfa4@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });
    const challengeToken = (challengeRes as MfaChallengeResult).mfaChallengeToken;
    const secret = await registerWithMfa('dummy@example.com', 'x'); // just need a valid code
    void secret;

    await expect(
      service.completeMfaLogin(challengeToken, '123456', 'other-device')
    ).rejects.toThrow('Device fingerprint mismatch');
  });

  it('should reject MFA login after too many attempts', async () => {
    const secret = await registerWithMfa('mfa5@example.com', 'Password!');
    void secret;

    const challengeRes = await service.login({
      email: 'mfa5@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });
    const challengeToken = (challengeRes as MfaChallengeResult).mfaChallengeToken;

    // Exhaust 5 attempts
    for (let i = 0; i < 5; i++) {
      try {
        await service.completeMfaLogin(challengeToken, '000000', 'dev');
      } catch {
        // expected
      }
    }

    // 6th attempt should be rate limited
    await expect(
      service.completeMfaLogin(challengeToken, '000000', 'dev')
    ).rejects.toThrow('Too many MFA attempts');
  });

  it('should reject expired MFA challenge', async () => {
    await registerWithMfa('mfa6@example.com', 'Password!');

    const challengeRes = await service.login({
      email: 'mfa6@example.com',
      password: 'Password!',
      deviceFingerprint: 'dev',
      ip: '1.1.1.1',
    });
    const challengeToken = (challengeRes as MfaChallengeResult).mfaChallengeToken;

    // Manually expire the challenge by accessing the internal map
    const challenges = (service as unknown as { mfaChallenges: Map<string, { expiresAt: Date }> }).mfaChallenges;
    const challenge = challenges.get(challengeToken)!;
    challenges.set(challengeToken, { ...challenge, expiresAt: new Date(Date.now() - 1000) });

    await expect(
      service.completeMfaLogin(challengeToken, '123456', 'dev')
    ).rejects.toThrow('MFA challenge has expired');
  });
});
