/**
 * Twilio adapter interface — SMS OTP delivery with email fallback.
 *
 * All secrets sourced from env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 *
 * When SMS delivery fails, the adapter triggers email fallback via the Resend adapter.
 * Rate limiting must be enforced at the call site for OTP endpoints.
 */

export type TwilioSmsOtpRequest = {
  to: string;
  otp: string;
  expiresInMinutes: number;
  locale?: string;
};

export type TwilioSmsResponse = {
  messageSid: string;
  to: string;
  from: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  sentAt: string;
};

export type TwilioDeliveryStatus = {
  messageSid: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: number;
  errorMessage?: string;
  updatedAt: string;
};

export interface ITwilioAdapter {
  /**
   * Send an OTP via SMS. Falls back to email via Resend adapter if SMS fails.
   * Returns the Twilio response; callers should check status for delivery confirmation.
   */
  sendSmsOtp(request: TwilioSmsOtpRequest): Promise<TwilioSmsResponse>;

  /**
   * Get the current delivery status of an SMS by message SID.
   */
  getDeliveryStatus(messageSid: string): Promise<TwilioDeliveryStatus>;
}
