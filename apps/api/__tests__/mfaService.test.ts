/**
 * Tests for TOTP MFA service — full lifecycle.
 *
 * Covers: setup, confirm, verify login, backup codes, disable.
 */
import { MfaService } from '../src/services/mfaService';
import { InMemoryMfaStore } from '../src/services/mfaStore';
import { authenticator } from '@otplib/preset-default';

// Set encryption key for tests (32 random bytes as hex)
process.env.MFA_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('MfaService', () => {
  let mfaService: MfaService;
  let store: InMemoryMfaStore;

  beforeEach(() => {
    store = new InMemoryMfaStore();
    mfaService = new MfaService(store);
  });

  describe('generateSecret (legacy compat)', () => {
    it('should generate a base32 TOTP secret', () => {
      const { secret, otpauthUrl } = mfaService.generateSecret('test@example.com', 'AfriSend');
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(10);
      expect(otpauthUrl).toContain('otpauth://totp/');
      expect(otpauthUrl).toContain('AfriSend');
    });

    it('should generate unique secrets each time', () => {
      const { secret: s1 } = mfaService.generateSecret('a@b.com', 'AfriSend');
      const { secret: s2 } = mfaService.generateSecret('a@b.com', 'AfriSend');
      expect(s1).not.toBe(s2);
    });

    it('should include the email in the otpauthUrl', () => {
      const email = 'user@afrisend.com';
      const { otpauthUrl } = mfaService.generateSecret(email, 'AfriSend');
      expect(otpauthUrl).toContain(encodeURIComponent(email));
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP code', () => {
      const { secret } = mfaService.generateSecret('test@example.com', 'AfriSend');
      const validCode = authenticator.generate(secret);
      expect(mfaService.verifyToken(secret, validCode)).toBe(true);
    });

    it('should reject a non-numeric code', () => {
      const { secret } = mfaService.generateSecret('test@example.com', 'AfriSend');
      expect(mfaService.verifyToken(secret, 'notanumber')).toBe(false);
    });

    it('should reject an empty code', () => {
      const { secret } = mfaService.generateSecret('test@example.com', 'AfriSend');
      expect(mfaService.verifyToken(secret, '')).toBe(false);
    });
  });

  describe('setup', () => {
    it('should return secret and otpauthUrl', async () => {
      const result = await mfaService.setup('user-1', 'test@example.com');

      expect(result.secret).toBeTruthy();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
    });

    it('should not enable MFA until confirmed', async () => {
      await mfaService.setup('user-1', 'test@example.com');
      const enabled = await mfaService.isEnabled('user-1');
      expect(enabled).toBe(false);
    });

    it('should reject setup if MFA is already enabled', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', validCode);

      await expect(mfaService.setup('user-1', 'test@example.com'))
        .rejects.toThrow('MFA is already enabled');
    });
  });

  describe('confirmSetup', () => {
    it('should activate MFA and return backup codes with a valid TOTP code', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);

      const result = await mfaService.confirmSetup('user-1', validCode);
      expect(result).not.toBeNull();
      expect(result!.backupCodes).toHaveLength(10);
      result!.backupCodes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });

      const enabled = await mfaService.isEnabled('user-1');
      expect(enabled).toBe(true);
    });

    it('should reject an invalid TOTP code', async () => {
      await mfaService.setup('user-1', 'test@example.com');
      const result = await mfaService.confirmSetup('user-1', 'invalid');
      expect(result).toBeNull();

      const enabled = await mfaService.isEnabled('user-1');
      expect(enabled).toBe(false);
    });

    it('should throw if setup was not started', async () => {
      await expect(mfaService.confirmSetup('user-1', '123456'))
        .rejects.toThrow('MFA setup not started');
    });
  });

  describe('verifyLogin', () => {
    it('should verify a valid TOTP code for an enrolled user', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', validCode);

      const loginCode = authenticator.generate(secret);
      const valid = await mfaService.verifyLogin('user-1', loginCode);
      expect(valid).toBe(true);
    });

    it('should return false for a user without MFA', async () => {
      const valid = await mfaService.verifyLogin('user-nope', '123456');
      expect(valid).toBe(false);
    });
  });

  describe('backup codes', () => {
    it('should accept a valid backup code', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      const result = await mfaService.confirmSetup('user-1', validCode);

      const valid = await mfaService.verifyBackupCode('user-1', result!.backupCodes[0]);
      expect(valid).toBe(true);
    });

    it('should not allow a backup code to be reused', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      const result = await mfaService.confirmSetup('user-1', validCode);

      await mfaService.verifyBackupCode('user-1', result!.backupCodes[0]);
      const reuse = await mfaService.verifyBackupCode('user-1', result!.backupCodes[0]);
      expect(reuse).toBe(false);
    });

    it('should reject an invalid backup code', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', validCode);

      const valid = await mfaService.verifyBackupCode('user-1', 'ZZZZ-ZZZZ');
      expect(valid).toBe(false);
    });
  });

  describe('disable', () => {
    it('should disable MFA with a valid TOTP code', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const confirmCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', confirmCode);

      const disableCode = authenticator.generate(secret);
      const disabled = await mfaService.disable('user-1', disableCode);
      expect(disabled).toBe(true);

      const enabled = await mfaService.isEnabled('user-1');
      expect(enabled).toBe(false);
    });

    it('should reject disable with invalid code', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const confirmCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', confirmCode);

      const disabled = await mfaService.disable('user-1', 'invalid');
      expect(disabled).toBe(false);

      const enabled = await mfaService.isEnabled('user-1');
      expect(enabled).toBe(true);
    });

    it('should throw if MFA is not set up', async () => {
      await expect(mfaService.disable('user-1', '123456'))
        .rejects.toThrow('MFA is not set up');
    });
  });

  describe('getStatus', () => {
    it('should return disabled status for new user', async () => {
      const status = await mfaService.getStatus('user-new');
      expect(status).toEqual({ enabled: false, confirmedAt: null });
    });

    it('should return enabled status after confirmation', async () => {
      const { secret } = await mfaService.setup('user-1', 'test@example.com');
      const validCode = authenticator.generate(secret);
      await mfaService.confirmSetup('user-1', validCode);

      const status = await mfaService.getStatus('user-1');
      expect(status.enabled).toBe(true);
      expect(status.confirmedAt).toBeTruthy();
    });
  });
});
