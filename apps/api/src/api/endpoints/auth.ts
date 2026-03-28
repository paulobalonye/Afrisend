import { post } from '../client';

export type OtpChannel = 'sms' | 'email';

export type SendOtpRequest = {
  phone: string;
  countryCode: string;
  channel?: OtpChannel;
};

export type SmsDeliveryStatusResponse = {
  sessionId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  deliveredAt: string | null;
  errorCode?: string;
};

export type SendOtpResponse = {
  sessionId: string;
  expiresAt: string;
};

export type VerifyOtpRequest = {
  sessionId: string;
  code: string;
  phone: string;
};

export type VerifyOtpResponse = {
  verified: boolean;
  isNewUser: boolean;
  temporaryToken: string;
};

export type RegisterRequest = {
  temporaryToken: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type User = {
  id: string;
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  kycTier: 0 | 1 | 2 | 3;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'more_info_needed';
  createdAt: string;
};

export type RegisterResponse = {
  user: User;
  tokens: AuthTokens;
};

export type ProfileSetupRequest = {
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  purpose: 'family' | 'business' | 'savings' | 'education' | 'other';
};

export async function sendOtp(data: SendOtpRequest): Promise<SendOtpResponse> {
  return post<SendOtpResponse>('/auth/otp/send', data);
}

export async function verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return post<VerifyOtpResponse>('/auth/otp/verify', data);
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return post<RegisterResponse>('/auth/register', data);
}

export async function setupProfile(data: ProfileSetupRequest): Promise<User> {
  return post<User>('/users/me/profile', data);
}

export async function signOut(): Promise<void> {
  await post('/auth/logout');
}

export async function getSmsDeliveryStatus(sessionId: string): Promise<SmsDeliveryStatusResponse> {
  return post<SmsDeliveryStatusResponse>('/auth/otp/delivery-status', { sessionId });
}
