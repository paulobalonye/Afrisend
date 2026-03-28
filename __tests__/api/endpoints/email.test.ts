import {
  sendEmailOtp,
  verifyEmailOtp,
  sendTemplatedEmail,
  getEmailDeliveryStatus,
  EmailTemplate,
} from '../../../src/api/endpoints/email';
import * as client from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const mockPost = client.post as jest.Mock;
const mockGet = client.get as jest.Mock;

describe('email API endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── sendEmailOtp ────────────────────────────────────────────────────────────

  describe('sendEmailOtp', () => {
    it('posts to /auth/email/otp/send and returns sessionId and messageId', async () => {
      const payload = { sessionId: 'sess-1', expiresAt: '2026-03-28T13:00:00Z', messageId: 'msg-1' };
      mockPost.mockResolvedValueOnce(payload);

      const result = await sendEmailOtp({ email: 'alice@example.com' });

      expect(mockPost).toHaveBeenCalledWith('/auth/email/otp/send', { email: 'alice@example.com' });
      expect(result).toEqual(payload);
    });

    it('forwards locale when provided', async () => {
      mockPost.mockResolvedValueOnce({ sessionId: 's', expiresAt: 'e', messageId: 'm' });

      await sendEmailOtp({ email: 'alice@example.com', locale: 'fr' });

      expect(mockPost).toHaveBeenCalledWith('/auth/email/otp/send', {
        email: 'alice@example.com',
        locale: 'fr',
      });
    });

    it('propagates API errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(sendEmailOtp({ email: 'alice@example.com' })).rejects.toThrow('Network error');
    });
  });

  // ── verifyEmailOtp ──────────────────────────────────────────────────────────

  describe('verifyEmailOtp', () => {
    it('posts to /auth/email/otp/verify and returns verified result', async () => {
      const payload = { verified: true, token: 'tok-abc' };
      mockPost.mockResolvedValueOnce(payload);

      const result = await verifyEmailOtp({
        sessionId: 'sess-1',
        code: '123456',
        email: 'alice@example.com',
      });

      expect(mockPost).toHaveBeenCalledWith('/auth/email/otp/verify', {
        sessionId: 'sess-1',
        code: '123456',
        email: 'alice@example.com',
      });
      expect(result).toEqual(payload);
    });

    it('returns verified: false on wrong code', async () => {
      mockPost.mockResolvedValueOnce({ verified: false });

      const result = await verifyEmailOtp({ sessionId: 's', code: '000000', email: 'a@b.com' });

      expect(result.verified).toBe(false);
      expect(result.token).toBeUndefined();
    });

    it('propagates API errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Rate limited'));

      await expect(
        verifyEmailOtp({ sessionId: 's', code: '1', email: 'a@b.com' }),
      ).rejects.toThrow('Rate limited');
    });
  });

  // ── sendTemplatedEmail ──────────────────────────────────────────────────────

  describe('sendTemplatedEmail', () => {
    it('posts to /notifications/email/send and returns messageId', async () => {
      const payload = { messageId: 'msg-42', status: 'queued' as const };
      mockPost.mockResolvedValueOnce(payload);

      const result = await sendTemplatedEmail({
        template: EmailTemplate.OTP,
        to: 'alice@example.com',
        data: { code: '654321' },
      });

      expect(mockPost).toHaveBeenCalledWith('/notifications/email/send', {
        template: 'otp',
        to: 'alice@example.com',
        data: { code: '654321' },
      });
      expect(result).toEqual(payload);
    });

    it('supports all template variants', async () => {
      mockPost.mockResolvedValue({ messageId: 'm', status: 'queued' as const });

      for (const template of Object.values(EmailTemplate)) {
        await sendTemplatedEmail({ template, to: 'a@b.com', data: {} });
        expect(mockPost).toHaveBeenCalledWith(
          '/notifications/email/send',
          expect.objectContaining({ template }),
        );
      }
    });

    it('propagates API errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Template not found'));

      await expect(
        sendTemplatedEmail({ template: EmailTemplate.WELCOME, to: 'a@b.com', data: {} }),
      ).rejects.toThrow('Template not found');
    });
  });

  // ── getEmailDeliveryStatus ──────────────────────────────────────────────────

  describe('getEmailDeliveryStatus', () => {
    it('calls GET /notifications/email/:messageId/status and returns status', async () => {
      const payload = { messageId: 'msg-1', status: 'delivered' as const, updatedAt: '2026-03-28T12:00:00Z' };
      mockGet.mockResolvedValueOnce(payload);

      const result = await getEmailDeliveryStatus('msg-1');

      expect(mockGet).toHaveBeenCalledWith('/notifications/email/msg-1/status');
      expect(result).toEqual(payload);
    });

    it('returns queued status for freshly sent message', async () => {
      mockGet.mockResolvedValueOnce({ messageId: 'm', status: 'queued', updatedAt: 'now' });

      const result = await getEmailDeliveryStatus('m');

      expect(result.status).toBe('queued');
    });

    it('propagates API errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'));

      await expect(getEmailDeliveryStatus('bad-id')).rejects.toThrow('Not found');
    });
  });
});
