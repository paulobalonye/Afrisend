/**
 * In-memory MFA store.
 * Production: replace with PostgreSQL queries against users + mfa_backup_codes tables.
 */
import type { IMfaStore, MfaStatus } from './mfaService';

type MfaRecord = {
  secret: string;
  enabled: boolean;
  confirmedAt: string | null;
};

type BackupCodeRecord = {
  codeHash: string;
  usedAt: string | null;
};

export class InMemoryMfaStore implements IMfaStore {
  private readonly records = new Map<string, MfaRecord>();
  private readonly backupCodes = new Map<string, BackupCodeRecord[]>();

  async getMfaSecret(userId: string): Promise<string | null> {
    return this.records.get(userId)?.secret ?? null;
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const record = this.records.get(userId);
    return record?.enabled === true && record.confirmedAt !== null;
  }

  async saveMfaSecret(userId: string, secret: string): Promise<void> {
    this.records.set(userId, { secret, enabled: false, confirmedAt: null });
  }

  async confirmMfa(userId: string): Promise<void> {
    const record = this.records.get(userId);
    if (!record) throw new Error('MFA record not found');
    this.records.set(userId, {
      ...record,
      enabled: true,
      confirmedAt: new Date().toISOString(),
    });
  }

  async disableMfa(userId: string): Promise<void> {
    this.records.delete(userId);
  }

  async getMfaStatus(userId: string): Promise<MfaStatus> {
    const record = this.records.get(userId);
    if (!record) return { enabled: false, confirmedAt: null };
    return { enabled: record.enabled, confirmedAt: record.confirmedAt };
  }

  async saveBackupCodes(userId: string, codeHashes: ReadonlyArray<string>): Promise<void> {
    const codes = codeHashes.map((codeHash) => ({ codeHash, usedAt: null }));
    this.backupCodes.set(userId, codes);
  }

  async getUnusedBackupCodeHashes(userId: string): Promise<ReadonlyArray<string>> {
    const codes = this.backupCodes.get(userId) ?? [];
    return codes.filter((c) => c.usedAt === null).map((c) => c.codeHash);
  }

  async markBackupCodeUsed(userId: string, codeHash: string): Promise<void> {
    const codes = this.backupCodes.get(userId) ?? [];
    this.backupCodes.set(
      userId,
      codes.map((c) =>
        c.codeHash === codeHash ? { ...c, usedAt: new Date().toISOString() } : c
      )
    );
  }

  async clearBackupCodes(userId: string): Promise<void> {
    this.backupCodes.delete(userId);
  }
}
