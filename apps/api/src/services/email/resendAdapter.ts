import {
  sendEmailOtp,
  verifyEmailOtp,
  sendTemplatedEmail,
  getEmailDeliveryStatus,
  EmailTemplate,
  SendEmailOtpResponse,
  VerifyEmailOtpResponse,
  SendTemplatedEmailResponse,
  GetDeliveryStatusResponse,
} from '@/api/endpoints/email';
import { EmailRateLimiter } from './emailRateLimiter';

type SendOtpOptions = {
  locale?: string;
};

type VerifyOtpParams = {
  sessionId: string;
  code: string;
  email: string;
};

export class ResendAdapter {
  private readonly rateLimiter: EmailRateLimiter;

  constructor(rateLimiter?: EmailRateLimiter) {
    this.rateLimiter = rateLimiter ?? new EmailRateLimiter();
  }

  async sendOtp(email: string, options: SendOtpOptions = {}): Promise<SendEmailOtpResponse> {
    this.rateLimiter.check(email);
    return sendEmailOtp({ email, ...options });
  }

  async verifyOtp(params: VerifyOtpParams): Promise<VerifyEmailOtpResponse> {
    const result = await verifyEmailOtp(params);
    if (result.verified) {
      this.rateLimiter.reset(params.email);
    }
    return result;
  }

  async sendEmail(
    template: EmailTemplate,
    to: string,
    data: Record<string, unknown>,
  ): Promise<SendTemplatedEmailResponse> {
    return sendTemplatedEmail({ template, to, data });
  }

  async getDeliveryStatus(messageId: string): Promise<GetDeliveryStatusResponse> {
    return getEmailDeliveryStatus(messageId);
  }
}
