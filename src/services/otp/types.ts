export type OtpChannel = 'sms' | 'email';

export type OtpDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';

export type OtpSession = {
  sessionId: string;
  expiresAt: string;
  channel: OtpChannel;
};

export type SmsDeliveryStatus = {
  sessionId: string;
  status: OtpDeliveryStatus;
  deliveredAt: string | null;
  errorCode?: string;
};
