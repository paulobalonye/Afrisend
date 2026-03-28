import { post, get } from '../client';

export enum EmailTemplate {
  OTP = 'otp',
  WELCOME = 'welcome',
  TRANSACTION = 'transaction',
  PASSWORD_RESET = 'password_reset',
}

export type SendEmailOtpRequest = {
  email: string;
  locale?: string;
};

export type SendEmailOtpResponse = {
  sessionId: string;
  expiresAt: string;
  messageId: string;
};

export type VerifyEmailOtpRequest = {
  sessionId: string;
  code: string;
  email: string;
};

export type VerifyEmailOtpResponse = {
  verified: boolean;
  token?: string;
};

export type SendTemplatedEmailRequest = {
  template: EmailTemplate;
  to: string;
  data: Record<string, unknown>;
};

export type SendTemplatedEmailResponse = {
  messageId: string;
  status: 'queued' | 'sent';
};

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

export type GetDeliveryStatusResponse = {
  messageId: string;
  status: DeliveryStatus;
  updatedAt: string;
};

export async function sendEmailOtp(data: SendEmailOtpRequest): Promise<SendEmailOtpResponse> {
  return post<SendEmailOtpResponse>('/auth/email/otp/send', data);
}

export async function verifyEmailOtp(data: VerifyEmailOtpRequest): Promise<VerifyEmailOtpResponse> {
  return post<VerifyEmailOtpResponse>('/auth/email/otp/verify', data);
}

export async function sendTemplatedEmail(
  data: SendTemplatedEmailRequest,
): Promise<SendTemplatedEmailResponse> {
  return post<SendTemplatedEmailResponse>('/notifications/email/send', data);
}

export async function getEmailDeliveryStatus(messageId: string): Promise<GetDeliveryStatusResponse> {
  return get<GetDeliveryStatusResponse>(`/notifications/email/${messageId}/status`);
}
