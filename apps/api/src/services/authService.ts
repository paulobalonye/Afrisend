/**
 * Auth service interface + default implementation.
 *
 * Handles user registration, token refresh, logout, and profile setup.
 * In production, replace the in-memory store with a real database.
 */

import type { User } from '@afrisend/shared';

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

export type ProfileSetupInput = {
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  purpose: 'family' | 'business' | 'savings' | 'education' | 'other';
};

export interface IAuthService {
  register(input: RegisterInput): Promise<RegisterResult>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
  logout(accessToken?: string): Promise<void>;
  setupProfile(userId: string, input: ProfileSetupInput): Promise<User>;
}

/** In-memory user store. Replace with a database in production. */
const userStore = new Map<string, User & { passwordHash: string; refreshToken?: string }>();

function generateToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class DefaultAuthService implements IAuthService {
  async register(input: RegisterInput): Promise<RegisterResult> {
    const userId = generateToken('usr');
    const user: User = {
      id: userId,
      phone: '',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      kycTier: 0,
      kycStatus: 'none',
      createdAt: new Date().toISOString(),
    };

    const accessToken = generateToken('acc');
    const refreshToken = generateToken('ref');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    userStore.set(userId, { ...user, passwordHash: input.password, refreshToken });

    return { user, tokens: { accessToken, refreshToken, expiresAt } };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Sandbox implementation: accept any non-empty refresh token
    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }
    return { accessToken: generateToken('acc') };
  }

  async logout(_accessToken?: string): Promise<void> {
    // In production: invalidate the token in a denylist
  }

  async setupProfile(_userId: string, input: ProfileSetupInput): Promise<User> {
    return {
      id: _userId || generateToken('usr'),
      phone: '',
      email: '',
      firstName: '',
      lastName: '',
      kycTier: 0,
      kycStatus: 'none',
      createdAt: new Date().toISOString(),
    };
  }
}
