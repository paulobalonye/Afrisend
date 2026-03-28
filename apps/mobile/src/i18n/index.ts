import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { appStorage } from '@/utils/storage';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  pt: 'Português',
};

function getInitialLanguage(): SupportedLanguage {
  const stored = appStorage.getLanguage();
  if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  const langCode = locale.split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(langCode) ? langCode : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export function changeLanguage(lang: SupportedLanguage): Promise<void> {
  return i18n.changeLanguage(lang).then(() => undefined);
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) ?? 'en';
}

export function getLanguageName(lang: SupportedLanguage): string {
  return LANGUAGE_NAMES[lang];
}

export default i18n;
