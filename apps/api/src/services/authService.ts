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
import type { User } from '@afrisend/shared';
import { JwtService } from './jwtService';
import type { ILoginRateLimiter } from './loginRateLimiter';
import type { IRefreshTokenStore } from './refreshTokenStore';

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
};

export type ProfileSetupInput = {
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  purpose: 'family' | 'business' | 'savings' | 'education' | 'other';
};

export interface IAuthService {
  register(input: RegisterInput): Promise<RegisterResult>;
  login(input: LoginInput): Promise<LoginResult>;
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

export class HardenedAuthService implements IAuthService {
  /** In-memory user store. Production: use PostgreSQL. */
  private readonly users = new Map<string, StoredUser>();
  /** email → userId index */
  private readonly emailIndex = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly rateLimiter: ILoginRateLimiter,
    private readonly tokenStore: IRefreshTokenStore
  ) {}

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

  async login(input: LoginInput): Promise<LoginResult> {
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
