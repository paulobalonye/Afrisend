import { sendOtp } from '@/api/endpoints/auth';
import type { OtpSession } from './types';

export class EmailOtpAdapter {
  async sendEmailOtp(phone: string, countryCode: string): Promise<OtpSession> {
    if (!phone) {
      throw new Error('Phone number is required');
    }
    if (!countryCode) {
      throw new Error('Country code is required');
    }

    const response = await sendOtp({ phone, countryCode, channel: 'email' });

    return {
      sessionId: response.sessionId,
      expiresAt: response.expiresAt,
      channel: 'email',
    };
  }
}
