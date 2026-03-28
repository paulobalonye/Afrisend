/**
 * RS256 JWT service.
 *
 * Generates RSA key pairs, signs access tokens (15-min expiry), and
 * signs opaque refresh tokens. One key pair per service instance.
 * In production, load the key pair from a secrets manager and support
 * key rotation by keeping the previous public key for verification.
 */
import { generateKeyPairSync, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

export type AccessTokenPayload = {
  userId: string;
  email: string;
  isAdmin?: boolean;
  exp?: number;
  iat?: number;
};

export class JwtService {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(privateKeyPem?: string, publicKeyPem?: string) {
    if (privateKeyPem && publicKeyPem) {
      this.privateKey = privateKeyPem;
      this.publicKey = publicKeyPem;
    } else {
      const pair = JwtService.generateKeyPairSync();
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
    }
  }

  static generateKeyPairSync(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    return { privateKey, publicKey };
  }

  async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    return JwtService.generateKeyPairSync();
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  async signAccessToken(payload: { userId: string; email: string; isAdmin?: boolean }): Promise<string> {
    return new Promise((resolve, reject) => {
      const claims: Record<string, unknown> = { userId: payload.userId, email: payload.email };
      if (payload.isAdmin) claims.isAdmin = true;
      jwt.sign(
        claims,
        this.privateKey,
        { algorithm: 'RS256', expiresIn: '15m' },
        (err, token) => {
          if (err || !token) return reject(err ?? new Error('Failed to sign token'));
          resolve(token);
        }
      );
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload & { exp: number; iat: number }> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err || !decoded) return reject(err ?? new Error('Invalid token'));
        resolve(decoded as AccessTokenPayload & { exp: number; iat: number });
      });
    });
  }

  /** Generate a cryptographically random opaque refresh token. */
  async signRefreshToken(_userId: string): Promise<string> {
    return randomBytes(48).toString('base64url');
  }
}
