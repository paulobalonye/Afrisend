import { OtpOrchestrator } from '../../src/services/otp/otpOrchestrator';
import { SmsOtpAdapter } from '../../src/services/otp/smsOtpAdapter';
import { EmailOtpAdapter } from '../../src/services/otp/emailOtpAdapter';

jest.mock('../../src/services/otp/smsOtpAdapter');
jest.mock('../../src/services/otp/emailOtpAdapter');

const MockSmsAdapter = SmsOtpAdapter as jest.MockedClass<typeof SmsOtpAdapter>;
const MockEmailAdapter = EmailOtpAdapter as jest.MockedClass<typeof EmailOtpAdapter>;

describe('OtpOrchestrator', () => {
  let orchestrator: OtpOrchestrator;
  let mockSmsInstance: jest.Mocked<SmsOtpAdapter>;
  let mockEmailInstance: jest.Mocked<EmailOtpAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmsInstance = {
      sendSmsOtp: jest.fn(),
      getDeliveryStatus: jest.fn(),
    } as unknown as jest.Mocked<SmsOtpAdapter>;

    mockEmailInstance = {
      sendEmailOtp: jest.fn(),
    } as unknown as jest.Mocked<EmailOtpAdapter>;

    MockSmsAdapter.mockImplementation(() => mockSmsInstance);
    MockEmailAdapter.mockImplementation(() => mockEmailInstance);

    orchestrator = new OtpOrchestrator();
  });

  describe('sendOtp', () => {
    it('sends via SMS first and returns sms session on success', async () => {
      mockSmsInstance.sendSmsOtp.mockResolvedValue({
        sessionId: 'sms-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'sms',
      });

      const result = await orchestrator.sendOtp('+2348012345678', 'NG');

      expect(mockSmsInstance.sendSmsOtp).toHaveBeenCalledWith('+2348012345678', 'NG');
      expect(mockEmailInstance.sendEmailOtp).not.toHaveBeenCalled();
      expect(result).toEqual({
        sessionId: 'sms-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'sms',
      });
    });

    it('falls back to email when SMS fails', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSmsInstance.sendSmsOtp.mockRejectedValue(
        new ApiError(503, 'SMS service unavailable', 'SMS_SERVICE_ERROR'),
      );
      mockEmailInstance.sendEmailOtp.mockResolvedValue({
        sessionId: 'email-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'email',
      });

      const result = await orchestrator.sendOtp('+2348012345678', 'NG');

      expect(mockSmsInstance.sendSmsOtp).toHaveBeenCalledWith('+2348012345678', 'NG');
      expect(mockEmailInstance.sendEmailOtp).toHaveBeenCalledWith('+2348012345678', 'NG');
      expect(result.channel).toBe('email');
    });

    it('falls back to email on rate limit error', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSmsInstance.sendSmsOtp.mockRejectedValue(
        new ApiError(429, 'Rate limit exceeded', 'RATE_LIMIT'),
      );
      mockEmailInstance.sendEmailOtp.mockResolvedValue({
        sessionId: 'email-session-2',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'email',
      });

      const result = await orchestrator.sendOtp('+2348012345678', 'NG');

      expect(result.channel).toBe('email');
    });

    it('throws when both SMS and email fail', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSmsInstance.sendSmsOtp.mockRejectedValue(
        new ApiError(503, 'SMS unavailable', 'SMS_SERVICE_ERROR'),
      );
      mockEmailInstance.sendEmailOtp.mockRejectedValue(
        new ApiError(503, 'Email unavailable', 'EMAIL_SERVICE_ERROR'),
      );

      await expect(orchestrator.sendOtp('+2348012345678', 'NG')).rejects.toThrow(
        'OTP delivery failed via all channels',
      );
    });

    it('does NOT fall back to email on validation errors (4xx client errors)', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSmsInstance.sendSmsOtp.mockRejectedValue(
        new ApiError(400, 'Invalid phone number', 'INVALID_PHONE'),
      );

      await expect(orchestrator.sendOtp('+invalid', 'NG')).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PHONE',
      });

      expect(mockEmailInstance.sendEmailOtp).not.toHaveBeenCalled();
    });
  });

  describe('getDeliveryStatus', () => {
    it('delegates to SMS adapter', async () => {
      mockSmsInstance.getDeliveryStatus.mockResolvedValue({
        sessionId: 'sms-session-1',
        status: 'delivered',
        deliveredAt: '2026-03-28T12:45:00Z',
      });

      const result = await orchestrator.getDeliveryStatus('sms-session-1');

      expect(mockSmsInstance.getDeliveryStatus).toHaveBeenCalledWith('sms-session-1');
      expect(result.status).toBe('delivered');
    });

    it('throws when sessionId is empty', async () => {
      await expect(orchestrator.getDeliveryStatus('')).rejects.toThrow('Session ID is required');
    });
  });
});
