import { SmsOtpAdapter } from '../../src/services/otp/smsOtpAdapter';
import * as authApi from '../../src/api/endpoints/auth';

jest.mock('../../src/api/endpoints/auth');

const mockSendOtp = authApi.sendOtp as jest.MockedFunction<typeof authApi.sendOtp>;
const mockDeliveryStatus = (authApi as unknown as Record<string, jest.Mock>)
  .getSmsDeliveryStatus as jest.MockedFunction<() => Promise<unknown>>;

describe('SmsOtpAdapter', () => {
  let adapter: SmsOtpAdapter;

  beforeEach(() => {
    adapter = new SmsOtpAdapter();
    jest.clearAllMocks();
  });

  describe('sendSmsOtp', () => {
    it('sends OTP via SMS and returns session', async () => {
      mockSendOtp.mockResolvedValue({
        sessionId: 'sms-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
      });

      const result = await adapter.sendSmsOtp('+2348012345678', 'NG');

      expect(mockSendOtp).toHaveBeenCalledWith({
        phone: '+2348012345678',
        countryCode: 'NG',
        channel: 'sms',
      });
      expect(result).toEqual({
        sessionId: 'sms-session-1',
        expiresAt: '2026-03-28T13:00:00Z',
        channel: 'sms',
      });
    });

    it('throws ApiError when backend rejects SMS OTP request', async () => {
      const { ApiError } = require('../../src/api/client');
      mockSendOtp.mockRejectedValue(new ApiError(429, 'Rate limit exceeded', 'RATE_LIMIT'));

      await expect(adapter.sendSmsOtp('+2348012345678', 'NG')).rejects.toMatchObject({
        statusCode: 429,
        code: 'RATE_LIMIT',
      });
    });

    it('throws when phone number is empty', async () => {
      await expect(adapter.sendSmsOtp('', 'NG')).rejects.toThrow('Phone number is required');
    });

    it('throws when country code is empty', async () => {
      await expect(adapter.sendSmsOtp('+2348012345678', '')).rejects.toThrow(
        'Country code is required',
      );
    });
  });

  describe('getDeliveryStatus', () => {
    it('returns delivery status for a given session', async () => {
      const { getSmsDeliveryStatus } = require('../../src/api/endpoints/auth');
      getSmsDeliveryStatus.mockResolvedValue({
        sessionId: 'sms-session-1',
        status: 'delivered',
        deliveredAt: '2026-03-28T12:45:00Z',
      });

      const result = await adapter.getDeliveryStatus('sms-session-1');

      expect(getSmsDeliveryStatus).toHaveBeenCalledWith('sms-session-1');
      expect(result).toEqual({
        sessionId: 'sms-session-1',
        status: 'delivered',
        deliveredAt: '2026-03-28T12:45:00Z',
      });
    });

    it('returns failed status on delivery failure', async () => {
      const { getSmsDeliveryStatus } = require('../../src/api/endpoints/auth');
      getSmsDeliveryStatus.mockResolvedValue({
        sessionId: 'sms-session-2',
        status: 'failed',
        errorCode: 'UNDELIVERABLE',
        deliveredAt: null,
      });

      const result = await adapter.getDeliveryStatus('sms-session-2');

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('UNDELIVERABLE');
    });

    it('throws when sessionId is empty', async () => {
      await expect(adapter.getDeliveryStatus('')).rejects.toThrow('Session ID is required');
    });
  });
});
