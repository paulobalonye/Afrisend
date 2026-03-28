import { create } from 'zustand';
import { appStorage } from '@/utils/storage';
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

type LanguageState = {
  currentLanguage: SupportedLanguage;
};

type LanguageActions = {
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
};

export const useLanguageStore = create<LanguageState & LanguageActions>((set) => ({
  currentLanguage: 'en',

  setLanguage: async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
    appStorage.setLanguage(lang);
    set({ currentLanguage: lang });
  },

  hydrateFromStorage: async () => {
    const stored = appStorage.getLanguage();
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      const lang = stored as SupportedLanguage;
      await i18n.changeLanguage(lang);
      set({ currentLanguage: lang });
    }
  },
}));
