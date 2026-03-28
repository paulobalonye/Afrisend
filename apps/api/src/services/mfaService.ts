/**
 * TOTP-based MFA service.
 *
 * Full MFA lifecycle:
 * - Setup: generate TOTP secret + otpauth URL for QR rendering
 * - Confirm: verify initial code to activate MFA
 * - Verify: check TOTP code during login
 * - Disable: turn off MFA for a user
 * - Backup codes: generate and verify single-use recovery codes
 *
 * Uses @otplib/preset-default (RFC 6238 TOTP).
 */
import { authenticator } from '@otplib/preset-default';
import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { encryptSecret, decryptSecret } from './mfaCrypto';

const BACKUP_CODE_COUNT = 10;
const BCRYPT_ROUNDS = 10;

export type MfaSetupResult = {
  readonly secret: string;
  readonly otpauthUrl: string;
};

export type MfaConfirmResult = {
  readonly backupCodes: ReadonlyArray<string>;
};

export type MfaStatus = {
  readonly enabled: boolean;
  readonly confirmedAt: string | null;
};

export interface IMfaStore {
  getMfaSecret(userId: string): Promise<string | null>;
  isMfaEnabled(userId: string): Promise<boolean>;
  saveMfaSecret(userId: string, encryptedSecret: string): Promise<void>;
  confirmMfa(userId: string): Promise<void>;
  disableMfa(userId: string): Promise<void>;
  getMfaStatus(userId: string): Promise<MfaStatus>;
  saveBackupCodes(userId: string, codeHashes: ReadonlyArray<string>): Promise<void>;
  getUnusedBackupCodeHashes(userId: string): Promise<ReadonlyArray<string>>;
  markBackupCodeUsed(userId: string, codeHash: string): Promise<void>;
  clearBackupCodes(userId: string): Promise<void>;
}

export class MfaService {
  constructor(private readonly store: IMfaStore) {}

  /**
   * Begin MFA setup: generate TOTP secret, otpauth URL, and backup codes.
   * Secret is stored but MFA is NOT active until confirmed.
   */
  async setup(userId: string, email: string, issuer: string = 'AfriSend'): Promise<MfaSetupResult> {
    const alreadyEnabled = await this.store.isMfaEnabled(userId);
    if (alreadyEnabled) {
      throw new Error('MFA is already enabled. Disable it first to re-enroll.');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);

    const encrypted = encryptSecret(secret);
    await this.store.saveMfaSecret(userId, encrypted);

    return { secret, otpauthUrl };
  }

  /**
   * Confirm MFA setup by verifying a TOTP code from the user's authenticator app.
   * This activates MFA and generates backup codes (only issued after successful confirmation).
   */
  async confirmSetup(userId: string, token: string): Promise<MfaConfirmResult | null> {
    const encrypted = await this.store.getMfaSecret(userId);
    if (!encrypted) {
      throw new Error('MFA setup not started. Call setup first.');
    }

    const secret = decryptSecret(encrypted);
    const valid = this.verifyToken(secret, token);
    if (!valid) {
      return null;
    }

    await this.store.confirmMfa(userId);

    // Generate backup codes only after successful confirmation
    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    const codeHashes = await Promise.all(
      backupCodes.map((code) => bcryptHash(code, BCRYPT_ROUNDS))
    );
    await this.store.clearBackupCodes(userId);
    await this.store.saveBackupCodes(userId, codeHashes);

    return { backupCodes };
  }

  /**
   * Verify a TOTP code during login.
   */
  async verifyLogin(userId: string, token: string): Promise<boolean> {
    const encrypted = await this.store.getMfaSecret(userId);
    if (!encrypted) {
      return false;
    }
    const secret = decryptSecret(encrypted);
    return this.verifyToken(secret, token);
  }

  /**
   * Verify a backup code during login (single-use).
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const hashes = await this.store.getUnusedBackupCodeHashes(userId);
    for (const hash of hashes) {
      const match = await bcryptCompare(code, hash);
      if (match) {
        await this.store.markBackupCodeUsed(userId, hash);
        return true;
      }
    }
    return false;
  }

  /**
   * Disable MFA for a user. Requires a valid TOTP code for confirmation.
   */
  async disable(userId: string, token: string): Promise<boolean> {
    const encrypted = await this.store.getMfaSecret(userId);
    if (!encrypted) {
      throw new Error('MFA is not set up for this account.');
    }

    const secret = decryptSecret(encrypted);
    const valid = this.verifyToken(secret, token);
    if (!valid) {
      return false;
    }

    await this.store.disableMfa(userId);
    await this.store.clearBackupCodes(userId);
    return true;
  }

  /**
   * Check if MFA is enabled for a user.
   */
  async isEnabled(userId: string): Promise<boolean> {
    return this.store.isMfaEnabled(userId);
  }

  /**
   * Get MFA status for a user.
   */
  async getStatus(userId: string): Promise<MfaStatus> {
    return this.store.getMfaStatus(userId);
  }

  /**
   * Verify a TOTP token against a secret.
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  /**
   * Generate a TOTP secret (used internally and for legacy compat).
   */
  generateSecret(email: string, issuer: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    return { secret, otpauthUrl };
  }
}

/**
 * Generate N random backup codes in format XXXX-XXXX.
 */
function generateBackupCodes(count: number): ReadonlyArray<string> {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(4);
    const hex = bytes.toString('hex').toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}
