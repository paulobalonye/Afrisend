import { sendOtp, getSmsDeliveryStatus } from '@/api/endpoints/auth';
import type { OtpSession, SmsDeliveryStatus } from './types';

export class SmsOtpAdapter {
  async sendSmsOtp(phone: string, countryCode: string): Promise<OtpSession> {
    if (!phone) {
      throw new Error('Phone number is required');
    }
    if (!countryCode) {
      throw new Error('Country code is required');
    }

    const response = await sendOtp({ phone, countryCode, channel: 'sms' });

    return {
      sessionId: response.sessionId,
      expiresAt: response.expiresAt,
      channel: 'sms',
    };
  }

  async getDeliveryStatus(sessionId: string): Promise<SmsDeliveryStatus> {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    return getSmsDeliveryStatus(sessionId);
  }
}
