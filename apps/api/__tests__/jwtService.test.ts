/**
 * Tests for RS256 JWT service.
 * TDD RED phase: these tests define expected behavior before implementation.
 */
import { JwtService } from '../src/services/jwtService';

describe('JwtService', () => {
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService();
  });

  describe('generateKeyPair', () => {
    it('should generate an RSA key pair', async () => {
      const { privateKey, publicKey } = await jwtService.generateKeyPair();
      expect(typeof privateKey).toBe('string');
      expect(typeof publicKey).toBe('string');
      expect(privateKey).toContain('BEGIN RSA PRIVATE KEY');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
    });
  });

  describe('signAccessToken', () => {
    it('should sign an access token with RS256', async () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = await jwtService.signAccessToken(payload);
      expect(typeof token).toBe('string');
      // JWT has 3 parts separated by dots
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should embed userId in the token payload', async () => {
      const payload = { userId: 'user-abc', email: 'a@b.com' };
      const token = await jwtService.signAccessToken(payload);
      const decoded = await jwtService.verifyAccessToken(token);
      expect(decoded.userId).toBe('user-abc');
    });

    it('should set expiry to 15 minutes', async () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const before = Math.floor(Date.now() / 1000);
      const token = await jwtService.signAccessToken(payload);
      const decoded = await jwtService.verifyAccessToken(token);
      const expectedExpiry = before + 15 * 60;
      // Allow 5s tolerance
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpiry - 5);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid RS256 token', async () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = await jwtService.signAccessToken(payload);
      const decoded = await jwtService.verifyAccessToken(token);
      expect(decoded.userId).toBe('user-123');
    });

    it('should reject a tampered token', async () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = await jwtService.signAccessToken(payload);
      // Tamper with the payload
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacker', email: 'evil@evil.com', exp: 9999999999 })).toString('base64url');
      const tampered = [parts[0], tamperedPayload, parts[2]].join('.');
      await expect(jwtService.verifyAccessToken(tampered)).rejects.toThrow();
    });

    it('should reject a token signed with wrong key', async () => {
      // Create a second service with different keys
      const otherService = new JwtService();
      // Force re-keying if they cache keys
      const payload = { userId: 'user-123', email: 'test@example.com' };
      // Sign with other service, verify with original should fail if keys differ
      // (Keys are generated fresh per instance)
      const token = await otherService.signAccessToken(payload);
      // otherService has different keys from jwtService
      // With different key pairs, verification should fail
      // This test is meaningful only if instances use separate key pairs
      await expect(jwtService.verifyAccessToken(token)).rejects.toThrow();
    });
  });

  describe('signRefreshToken', () => {
    it('should return a refresh token string', async () => {
      const token = await jwtService.signRefreshToken('user-123');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens on each call', async () => {
      const t1 = await jwtService.signRefreshToken('user-123');
      const t2 = await jwtService.signRefreshToken('user-123');
      expect(t1).not.toBe(t2);
    });
  });
});
