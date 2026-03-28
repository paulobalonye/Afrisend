/**
 * OTP service interface + default implementation.
 *
 * The interface allows dependency injection in tests.
 * The default implementation calls the Twilio and Resend adapters directly.
 */

export type SmsOtpResult = {
  sessionId: string;
  expiresAt: string;
};

export type OtpVerifyResult = {
  verified: boolean;
  isNewUser: boolean;
  temporaryToken: string;
};

export type EmailOtpResult = {
  sessionId: string;
  expiresAt: string;
  messageId: string;
};

export type EmailOtpVerifyResult = {
  verified: boolean;
  token?: string;
};

export type SmsDeliveryStatusResult = {
  sessionId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  deliveredAt: string | null;
  errorCode?: string;
};

export interface IOtpService {
  sendSmsOtp(phone: string, countryCode: string): Promise<SmsOtpResult>;
  verifySmsOtp(sessionId: string, code: string, phone: string): Promise<OtpVerifyResult>;
  sendEmailOtp(email: string, locale?: string): Promise<EmailOtpResult>;
  verifyEmailOtp(sessionId: string, code: string, email: string): Promise<EmailOtpVerifyResult>;
  getSmsDeliveryStatus(sessionId: string): Promise<SmsDeliveryStatusResult>;
}

/** In-memory OTP session store. Replace with Redis or DB in production. */
const sessionStore = new Map<string, { code: string; phone?: string; email?: string; expiresAt: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class DefaultOtpService implements IOtpService {
  async sendSmsOtp(phone: string, countryCode: string): Promise<SmsOtpResult> {
    const sessionId = generateSessionId();
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    sessionStore.set(sessionId, { code, phone, expiresAt: Date.now() + 10 * 60 * 1000 });

    // In sandbox mode, log the OTP code (never in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP-SMS sandbox] phone=${phone} countryCode=${countryCode} code=${code}`);
    }

    return { sessionId, expiresAt };
  }

  async verifySmsOtp(sessionId: string, code: string, phone: string): Promise<OtpVerifyResult> {
    const session = sessionStore.get(sessionId);

    if (!session || Date.now() > session.expiresAt) {
      return { verified: false, isNewUser: false, temporaryToken: '' };
    }

    const verified = session.code === code;
    if (verified) {
      sessionStore.delete(sessionId);
    }

    return {
      verified,
      isNewUser: false,
      temporaryToken: verified ? `tmp-${sessionId}-${Date.now()}` : '',
    };
  }

  async sendEmailOtp(email: string, locale?: string): Promise<EmailOtpResult> {
    const sessionId = generateSessionId();
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    sessionStore.set(sessionId, { code, email, expiresAt: Date.now() + 10 * 60 * 1000 });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP-EMAIL sandbox] email=${email} locale=${locale ?? 'en'} code=${code}`);
    }

    return { sessionId, expiresAt, messageId: `msg-${sessionId}` };
  }

  async verifyEmailOtp(sessionId: string, code: string, email: string): Promise<EmailOtpVerifyResult> {
    const session = sessionStore.get(sessionId);

    if (!session || Date.now() > session.expiresAt) {
      return { verified: false };
    }

    const verified = session.code === code;
    if (verified) {
      sessionStore.delete(sessionId);
    }

    return {
      verified,
      token: verified ? `email-tok-${sessionId}` : undefined,
    };
  }

  async getSmsDeliveryStatus(sessionId: string): Promise<SmsDeliveryStatusResult> {
    return {
      sessionId,
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
    };
  }
}
