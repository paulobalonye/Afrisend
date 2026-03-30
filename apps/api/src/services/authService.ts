/**
 * Auth service — hardened implementation.
 *
 * - RS256 JWT access tokens (15-min expiry)
 * - Refresh token rotation with device fingerprint binding (7-day expiry)
 * - bcrypt password hashing
 * - Login rate limiting (5 failures → 15-min lockout per IP + per account)
 * - TOTP MFA foundation via MfaService
 * - Existing OTP flows (SMS + email) unchanged
 */
import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { User } from '@afrisend/shared';
import { JwtService } from './jwtService';
import type { ILoginRateLimiter } from './loginRateLimiter';
import { LoginRateLimiter } from './loginRateLimiter';
import type { IRefreshTokenStore } from './refreshTokenStore';
import { InMemoryRefreshTokenStore } from './refreshTokenStore';
import type { MfaService } from './mfaService';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type RegisterInput = {
  temporaryToken: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type RegisterResult = {
  user: User;
  tokens: AuthTokens;
};

export type LoginInput = {
  email: string;
  password: string;
  deviceFingerprint: string;
  ip: string;
};

export type LoginResult = {
  user: User;
  tokens: AuthTokens;
  mfaRequired?: never;
};

export type MfaChallengeResult = {
  mfaRequired: true;
  mfaChallengeToken: string;
  user?: never;
  tokens?: never;
};

export type LoginResponse = LoginResult | MfaChallengeResult;

export type ProfileSetupInput = {
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  purpose: 'family' | 'business' | 'savings' | 'education' | 'other';
};

export interface IAuthService {
  register(input: RegisterInput): Promise<RegisterResult>;
  login(input: LoginInput): Promise<LoginResponse>;
  completeMfaLogin(challengeToken: string, totpCode: string, deviceFingerprint: string): Promise<LoginResult>;
  refreshToken(refreshToken: string, deviceFingerprint: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(accessToken?: string, refreshToken?: string): Promise<void>;
  setupProfile(userId: string, input: ProfileSetupInput): Promise<User>;
}

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_TTL_DAYS = 7;

type StoredUser = User & { passwordHash: string };

function generateId(): string {
  return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MFA_MAX_ATTEMPTS = 5;
const MFA_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

export class HardenedAuthService implements IAuthService {
  /** In-memory user store. Production: use PostgreSQL. */
  private readonly users = new Map<string, StoredUser>();
  /** email → userId index */
  private readonly emailIndex = new Map<string, string>();
  /** MFA challenge tokens: token → { userId, deviceFingerprint, expiresAt, attempts } */
  private readonly mfaChallenges = new Map<string, { userId: string; deviceFingerprint: string; expiresAt: Date; attempts: number }>();
  /** Periodic cleanup timer for expired MFA challenges */
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwtService: JwtService = new JwtService(),
    private readonly rateLimiter: ILoginRateLimiter = new LoginRateLimiter(),
    private readonly tokenStore: IRefreshTokenStore = new InMemoryRefreshTokenStore(),
    private readonly mfaService?: MfaService
  ) {
    // Periodically sweep expired MFA challenges to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      const now = new Date();
      for (const [token, challenge] of this.mfaChallenges) {
        if (challenge.expiresAt < now) {
          this.mfaChallenges.delete(token);
        }
      }
    }, MFA_CLEANUP_INTERVAL_MS);
    // Allow Node to exit even if timer is active
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const { firstName, lastName, email, password } = input;
    const passwordHash = await bcryptHash(password, BCRYPT_ROUNDS);
    const userId = generateId();

    const user: User = {
      id: userId,
      phone: '',
      email,
      firstName,
      lastName,
      kycTier: 0,
      kycStatus: 'none',
      createdAt: new Date().toISOString(),
    };

    this.users.set(userId, { ...user, passwordHash });
    this.emailIndex.set(email.toLowerCase(), userId);

    const tokens = await this.issueTokens(userId, email, 'registration');
    return { user, tokens };
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const { email, password, deviceFingerprint, ip } = input;

    const lockResult = await this.rateLimiter.isLocked(email, ip);
    if (lockResult.locked) {
      throw new Error(`Account locked due to too many failed attempts. Try again later.`);
    }

    const userId = this.emailIndex.get(email.toLowerCase());
    const storedUser = userId ? this.users.get(userId) : undefined;

    if (!storedUser) {
      await this.rateLimiter.recordFailure(email, ip);
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await bcryptCompare(password, storedUser.passwordHash);
    if (!passwordMatch) {
      await this.rateLimiter.recordFailure(storedUser.id, ip);
      throw new Error('Invalid credentials');
    }

    await this.rateLimiter.recordSuccess(storedUser.id, ip);

    // If MFA is enabled, return a challenge instead of tokens
    if (this.mfaService) {
      const mfaEnabled = await this.mfaService.isEnabled(storedUser.id);
      if (mfaEnabled) {
        const challengeToken = randomBytes(32).toString('hex');
        this.mfaChallenges.set(challengeToken, {
          userId: storedUser.id,
          deviceFingerprint,
          expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
          attempts: 0,
        });
        return { mfaRequired: true, mfaChallengeToken: challengeToken };
      }
    }

    const tokens = await this.issueTokens(storedUser.id, storedUser.email, deviceFingerprint);
    const { passwordHash: _ph, ...user } = storedUser;
    return { user, tokens };
  }

  async completeMfaLogin(
    challengeToken: string,
    totpCode: string,
    deviceFingerprint: string
  ): Promise<LoginResult> {
    const challenge = this.mfaChallenges.get(challengeToken);
    if (!challenge) {
      throw new Error('Invalid or expired MFA challenge');
    }
    if (challenge.expiresAt < new Date()) {
      this.mfaChallenges.delete(challengeToken);
      throw new Error('MFA challenge has expired');
    }
    if (challenge.deviceFingerprint !== deviceFingerprint) {
      this.mfaChallenges.delete(challengeToken);
      throw new Error('Device fingerprint mismatch');
    }

    if (!this.mfaService) {
      throw new Error('MFA service not configured');
    }

    // Rate limit: max 5 attempts per challenge token
    if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
      this.mfaChallenges.delete(challengeToken);
      throw new Error('Too many MFA attempts. Please log in again.');
    }
    this.mfaChallenges.set(challengeToken, { ...challenge, attempts: challenge.attempts + 1 });

    // Determine code type by format: XXXX-XXXX = backup code, 6 digits = TOTP
    const isBackupCode = /^[A-F0-9]{4}-[A-F0-9]{4}$/i.test(totpCode);
    const valid = isBackupCode
      ? await this.mfaService.verifyBackupCode(challenge.userId, totpCode)
      : await this.mfaService.verifyLogin(challenge.userId, totpCode);

    if (!valid) {
      throw new Error('Invalid MFA code');
    }

    this.mfaChallenges.delete(challengeToken);

    const storedUser = this.users.get(challenge.userId);
    if (!storedUser) throw new Error('User not found');

    const tokens = await this.issueTokens(storedUser.id, storedUser.email, deviceFingerprint);
    const { passwordHash: _ph, ...user } = storedUser;
    return { user, tokens };
  }

  async refreshToken(
    refreshToken: string,
    deviceFingerprint: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.tokenStore.lookup(refreshToken);

    if (!stored) {
      throw new Error('Invalid or expired refresh token');
    }
    if (stored.revokedAt) {
      throw new Error('Refresh token has been revoked');
    }
    if (stored.expiresAt < new Date()) {
      throw new Error('Refresh token has expired');
    }
    if (stored.deviceFingerprint !== deviceFingerprint) {
      await this.tokenStore.revokeAllForUser(stored.userId);
      throw new Error('Device fingerprint mismatch — all sessions invalidated');
    }

    await this.tokenStore.revoke(refreshToken);

    const storedUser = this.users.get(stored.userId);
    if (!storedUser) throw new Error('User not found');

    const newAccessToken = await this.jwtService.signAccessToken({
      userId: storedUser.id,
      email: storedUser.email,
    });
    const newRefreshToken = await this.jwtService.signRefreshToken(storedUser.id);

    await this.tokenStore.store(newRefreshToken, {
      userId: storedUser.id,
      deviceFingerprint,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(accessToken?: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.tokenStore.revoke(refreshToken);
    }
    // Production: add accessToken to a Redis denylist with TTL = remaining exp
    void accessToken;
  }

  async setupProfile(_userId: string, _input: ProfileSetupInput): Promise<User> {
    const storedUser = this.users.get(_userId);
    if (!storedUser) throw new Error('User not found');
    const { passwordHash: _ph, ...user } = storedUser;
    return user;
  }

  private async issueTokens(
    userId: string,
    email: string,
    deviceFingerprint: string
  ): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAccessToken({ userId, email });
    const refreshToken = await this.jwtService.signRefreshToken(userId);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.tokenStore.store(refreshToken, {
      userId,
      deviceFingerprint,
      expiresAt,
      revokedAt: null,
    });

    return { accessToken, refreshToken, expiresAt: expiresAt.toISOString() };
  }
}

/** Keep legacy alias for existing route wiring. */
export { HardenedAuthService as DefaultAuthService };
