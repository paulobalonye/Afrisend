import { EmailOtpAdapter } from '../../src/services/otp/emailOtpAdapter';
import * as authApi from '../../src/api/endpoints/auth';

jest.mock('../../src/api/endpoints/auth');

const mockSendOtp = authApi.sendOtp as jest.MockedFunction<typeof authApi.sendOtp>;

describe('EmailOtpAdapter', () => {
  let adapter: EmailOtpAdapter;

  beforeEach(() => {
    adapter = new EmailOtpAdapter();
    jest.clearAllMocks();
  });

  describe('sendEmailOtp', () => {
    it('sends OTP via email and returns session', async () => {
      mockSendOtp.mockResolvedValue({
        sessionId: 'email-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
      });

      const result = await adapter.sendEmailOtp('+2348012345678', 'NG');

      expect(mockSendOtp).toHaveBeenCalledWith({
        phone: '+2348012345678',
        countryCode: 'NG',
        channel: 'email',
      });
      expect(result).toEqual({
        sessionId: 'email-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'email',
      });
    });

    it('throws ApiError on backend rejection', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSendOtp.mockRejectedValue(new ApiError(422, 'Email not found', 'EMAIL_NOT_FOUND'));

      await expect(adapter.sendEmailOtp('+2348012345678', 'NG')).rejects.toMatchObject({
        statusCode: 422,
        code: 'EMAIL_NOT_FOUND',
      });
    });

    it('throws when phone is empty', async () => {
      await expect(adapter.sendEmailOtp('', 'NG')).rejects.toThrow('Phone number is required');
    });

    it('throws when countryCode is empty', async () => {
      await expect(adapter.sendEmailOtp('+2348012345678', '')).rejects.toThrow(
        'Country code is required',
      );
    });
  });
});
