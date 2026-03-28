/**
 * Refresh token store interface and in-memory implementation.
 *
 * In production, back this with Redis using TTL keys so tokens
 * auto-expire and memory is bounded.
 */
import { createHash } from 'crypto';

export type StoredRefreshToken = {
  userId: string;
  deviceFingerprint: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface IRefreshTokenStore {
  store(token: string, data: StoredRefreshToken): Promise<void>;
  lookup(token: string): Promise<StoredRefreshToken | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class InMemoryRefreshTokenStore implements IRefreshTokenStore {
  private readonly tokens = new Map<string, StoredRefreshToken>();

  async store(token: string, data: StoredRefreshToken): Promise<void> {
    this.tokens.set(hashToken(token), { ...data });
  }

  async lookup(token: string): Promise<StoredRefreshToken | null> {
    return this.tokens.get(hashToken(token)) ?? null;
  }

  async revoke(token: string): Promise<void> {
    const key = hashToken(token);
    const record = this.tokens.get(key);
    if (record) {
      this.tokens.set(key, { ...record, revokedAt: new Date() });
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();
    for (const [key, record] of this.tokens) {
      if (record.userId === userId && !record.revokedAt) {
        this.tokens.set(key, { ...record, revokedAt: now });
      }
    }
  }
}
