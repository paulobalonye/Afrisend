/**
 * TOTP-based MFA service.
 *
 * Provides the foundation for Phase 2 MFA integration:
 * - Generate a TOTP secret + otpauth URL (for QR code rendering)
 * - Verify a 6-digit TOTP code against a stored secret
 *
 * Uses @otplib/preset-default which implements RFC 6238 (TOTP).
 */
import { authenticator } from '@otplib/preset-default';

export type MfaSecretResult = {
  secret: string;
  otpauthUrl: string;
};

export class MfaService {
  /**
   * Generate a new TOTP secret for the given user.
   * Returns the base32-encoded secret and an otpauth:// URL for QR rendering.
   */
  generateSecret(email: string, issuer: string): MfaSecretResult {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    return { secret, otpauthUrl };
  }

  /**
   * Verify a TOTP code against the stored secret.
   * Returns true if valid (within the allowed time window).
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
