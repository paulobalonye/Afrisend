import { post, get } from './client';
import type { User } from '@/types';

export type RegisterRequest = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type OtpRequest = {
  sessionId: string;
  otp: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = {
  requiresMfa: boolean;
  sessionId?: string;
  tokens?: AuthTokens;
  user?: User;
};

export async function register(data: RegisterRequest): Promise<{ message: string }> {
  return post<{ message: string }>('/auth/register', data);
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', data);
}

export async function verifyOtp(data: OtpRequest): Promise<{ tokens: AuthTokens; user: User }> {
  return post<{ tokens: AuthTokens; user: User }>('/auth/verify-otp', data);
}

export async function getMe(): Promise<User> {
  return get<User>('/users/me');
}

export async function refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
  return post<{ accessToken: string }>('/auth/refresh', { refreshToken });
}
