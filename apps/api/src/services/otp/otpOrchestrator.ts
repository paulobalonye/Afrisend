import { ApiError } from '@/api/client';
import { SmsOtpAdapter } from './smsOtpAdapter';
import { EmailOtpAdapter } from './emailOtpAdapter';
import type { OtpSession, SmsDeliveryStatus } from './types';

const SMS_FALLBACK_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export class OtpOrchestrator {
  private readonly smsAdapter: SmsOtpAdapter;
  private readonly emailAdapter: EmailOtpAdapter;

  constructor(smsAdapter?: SmsOtpAdapter, emailAdapter?: EmailOtpAdapter) {
    this.smsAdapter = smsAdapter ?? new SmsOtpAdapter();
    this.emailAdapter = emailAdapter ?? new EmailOtpAdapter();
  }

  async sendOtp(phone: string, countryCode: string): Promise<OtpSession> {
    try {
      return await this.smsAdapter.sendSmsOtp(phone, countryCode);
    } catch (smsError) {
      if (smsError instanceof ApiError && !SMS_FALLBACK_STATUS_CODES.has(smsError.statusCode)) {
        throw smsError;
      }

      try {
        return await this.emailAdapter.sendEmailOtp(phone, countryCode);
      } catch {
        throw new Error('OTP delivery failed via all channels');
      }
    }
  }

  async getDeliveryStatus(sessionId: string): Promise<SmsDeliveryStatus> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    return this.smsAdapter.getDeliveryStatus(sessionId);
  }
}
