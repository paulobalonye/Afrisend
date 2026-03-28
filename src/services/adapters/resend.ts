/**
 * Resend adapter interface — transactional email delivery, including OTP emails.
 *
 * All secrets sourced from env vars:
 *   RESEND_API_KEY
 *
 * Rate limiting must be enforced at the call site for OTP endpoints.
 */

export type ResendOtpRequest = {
  to: string;
  otp: string;
  expiresInMinutes: number;
  locale?: string;
};

export type ResendEmailRequest = {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
};

export type ResendEmailResponse = {
  messageId: string;
  to: string | string[];
  subject: string;
  sentAt: string;
};

export type ResendDeliveryStatus = {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';
  updatedAt: string;
  errorMessage?: string;
};

export interface IResendAdapter {
  /**
   * Send an OTP email to a single recipient.
   * The implementation is responsible for formatting the OTP email from a template.
   */
  sendOtp(request: ResendOtpRequest): Promise<ResendEmailResponse>;

  /**
   * Send a generic transactional email.
   */
  sendEmail(request: ResendEmailRequest): Promise<ResendEmailResponse>;

  /**
   * Get the current delivery status of a sent email by message ID.
   */
  getDeliveryStatus(messageId: string): Promise<ResendDeliveryStatus>;
}
