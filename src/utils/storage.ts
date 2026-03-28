import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

// Secure storage for sensitive data (tokens, keys)
const SECURE_KEYS = {
  ACCESS_TOKEN: 'afrisend_access_token',
  REFRESH_TOKEN: 'afrisend_refresh_token',
  DEVICE_ID: 'afrisend_device_id',
} as const;

export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, token);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN);
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN),
  ]);
}

// Fast storage for non-sensitive data (preferences, cache)
export const storage = new MMKV({ id: 'afrisend-storage' });

const STORAGE_KEYS = {
  LANGUAGE: 'language',
  THEME: 'theme',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  KYC_TIER: 'kyc_tier',
  LAST_KNOWN_PHONE: 'last_known_phone',
} as const;

export const appStorage = {
  getLanguage: (): string | undefined => storage.getString(STORAGE_KEYS.LANGUAGE),
  setLanguage: (lang: string): void => storage.set(STORAGE_KEYS.LANGUAGE, lang),

  getTheme: (): string | undefined => storage.getString(STORAGE_KEYS.THEME),
  setTheme: (theme: string): void => storage.set(STORAGE_KEYS.THEME, theme),

  isOnboardingComplete: (): boolean => storage.getBoolean(STORAGE_KEYS.ONBOARDING_COMPLETE) ?? false,
  setOnboardingComplete: (): void => storage.set(STORAGE_KEYS.ONBOARDING_COMPLETE, true),

  getKycTier: (): number => storage.getNumber(STORAGE_KEYS.KYC_TIER) ?? 0,
  setKycTier: (tier: number): void => storage.set(STORAGE_KEYS.KYC_TIER, tier),

  getLastKnownPhone: (): string | undefined => storage.getString(STORAGE_KEYS.LAST_KNOWN_PHONE),
  setLastKnownPhone: (phone: string): void => storage.set(STORAGE_KEYS.LAST_KNOWN_PHONE, phone),

  clearAll: (): void => storage.clearAll(),
};
