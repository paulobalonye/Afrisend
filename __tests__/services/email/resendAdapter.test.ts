import { ResendAdapter } from '../../../src/services/email/resendAdapter';
import { EmailRateLimiter, RateLimitExceededError } from '../../../src/services/email/emailRateLimiter';
import * as emailEndpoints from '../../../src/api/endpoints/email';
import { EmailTemplate } from '../../../src/api/endpoints/email';

jest.mock('../../../src/api/endpoints/email');

const mockSendEmailOtp = emailEndpoints.sendEmailOtp as jest.Mock;
const mockVerifyEmailOtp = emailEndpoints.verifyEmailOtp as jest.Mock;
const mockSendTemplatedEmail = emailEndpoints.sendTemplatedEmail as jest.Mock;
const mockGetEmailDeliveryStatus = emailEndpoints.getEmailDeliveryStatus as jest.Mock;

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;
  let mockRateLimiter: { check: jest.Mock; reset: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRateLimiter = {
      check: jest.fn(),
      reset: jest.fn(),
    };

    adapter = new ResendAdapter(mockRateLimiter as unknown as EmailRateLimiter);
  });

  // ── sendOtp ─────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('checks rate limit before sending OTP', async () => {
      mockSendEmailOtp.mockResolvedValueOnce({
        sessionId: 'sess-1',
        expiresAt: '2026-03-28T13:00:00Z',
        messageId: 'msg-1',
      });

      await adapter.sendOtp('alice@example.com');

      expect(mockRateLimiter.check).toHaveBeenCalledWith('alice@example.com');
    });

    it('returns sessionId, expiresAt, and messageId on success', async () => {
      const response = { sessionId: 'sess-1', expiresAt: '2026-03-28T13:00:00Z', messageId: 'msg-1' };
      mockSendEmailOtp.mockResolvedValueOnce(response);

      const result = await adapter.sendOtp('alice@example.com');

      expect(result).toEqual(response);
    });

    it('calls sendEmailOtp with correct email', async () => {
      mockSendEmailOtp.mockResolvedValueOnce({
        sessionId: 's',
        expiresAt: 'e',
        messageId: 'm',
      });

      await adapter.sendOtp('bob@example.com');

      expect(mockSendEmailOtp).toHaveBeenCalledWith({ email: 'bob@example.com' });
    });

    it('throws RateLimitExceededError when rate limit is hit (does not call API)', async () => {
      const rateLimitError = new RateLimitExceededError('alice@example.com', 30000);
      mockRateLimiter.check.mockImplementationOnce(() => { throw rateLimitError; });

      await expect(adapter.sendOtp('alice@example.com')).rejects.toThrow(RateLimitExceededError);
      expect(mockSendEmailOtp).not.toHaveBeenCalled();
    });

    it('forwards locale option to the API', async () => {
      mockSendEmailOtp.mockResolvedValueOnce({ sessionId: 's', expiresAt: 'e', messageId: 'm' });

      await adapter.sendOtp('alice@example.com', { locale: 'fr' });

      expect(mockSendEmailOtp).toHaveBeenCalledWith({ email: 'alice@example.com', locale: 'fr' });
    });
  });

  // ── verifyOtp ────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('calls verifyEmailOtp and returns the result', async () => {
      const response = { verified: true, token: 'tok-abc' };
      mockVerifyEmailOtp.mockResolvedValueOnce(response);

      const result = await adapter.verifyOtp({
        sessionId: 'sess-1',
        code: '123456',
        email: 'alice@example.com',
      });

      expect(mockVerifyEmailOtp).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        code: '123456',
        email: 'alice@example.com',
      });
      expect(result).toEqual(response);
    });

    it('resets rate limiter on successful verification', async () => {
      mockVerifyEmailOtp.mockResolvedValueOnce({ verified: true, token: 'tok' });

      await adapter.verifyOtp({ sessionId: 's', code: '1', email: 'alice@example.com' });

      expect(mockRateLimiter.reset).toHaveBeenCalledWith('alice@example.com');
    });

    it('does not reset limiter when verification fails', async () => {
      mockVerifyEmailOtp.mockResolvedValueOnce({ verified: false });

      await adapter.verifyOtp({ sessionId: 's', code: 'bad', email: 'alice@example.com' });

      expect(mockRateLimiter.reset).not.toHaveBeenCalled();
    });

    it('propagates API errors', async () => {
      mockVerifyEmailOtp.mockRejectedValueOnce(new Error('Expired OTP'));

      await expect(
        adapter.verifyOtp({ sessionId: 's', code: '1', email: 'a@b.com' }),
      ).rejects.toThrow('Expired OTP');
    });
  });

  // ── sendEmail ────────────────────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('sends a templated email and returns messageId', async () => {
      const response = { messageId: 'msg-99', status: 'queued' as const };
      mockSendTemplatedEmail.mockResolvedValueOnce(response);

      const result = await adapter.sendEmail(EmailTemplate.WELCOME, 'alice@example.com', {
        name: 'Alice',
      });

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith({
        template: EmailTemplate.WELCOME,
        to: 'alice@example.com',
        data: { name: 'Alice' },
      });
      expect(result).toEqual(response);
    });

    it('supports all template types', async () => {
      mockSendTemplatedEmail.mockResolvedValue({ messageId: 'm', status: 'queued' as const });

      for (const template of Object.values(EmailTemplate)) {
        await adapter.sendEmail(template, 'a@b.com', {});
        expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({ template }),
        );
      }
    });

    it('propagates API errors', async () => {
      mockSendTemplatedEmail.mockRejectedValueOnce(new Error('Template error'));

      await expect(
        adapter.sendEmail(EmailTemplate.OTP, 'a@b.com', {}),
      ).rejects.toThrow('Template error');
    });
  });

  // ── getDeliveryStatus ────────────────────────────────────────────────────────

  describe('getDeliveryStatus', () => {
    it('fetches and returns delivery status', async () => {
      const response = { messageId: 'msg-1', status: 'delivered' as const, updatedAt: '2026-03-28T12:00:00Z' };
      mockGetEmailDeliveryStatus.mockResolvedValueOnce(response);

      const result = await adapter.getDeliveryStatus('msg-1');

      expect(mockGetEmailDeliveryStatus).toHaveBeenCalledWith('msg-1');
      expect(result).toEqual(response);
    });

    it('propagates API errors', async () => {
      mockGetEmailDeliveryStatus.mockRejectedValueOnce(new Error('Not found'));

      await expect(adapter.getDeliveryStatus('bad-id')).rejects.toThrow('Not found');
    });
  });
});
