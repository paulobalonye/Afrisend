import { act } from '@testing-library/react-hooks';
import { useLanguageStore } from '../languageStore';
import { appStorage } from '@/utils/storage';
import i18n from '@/i18n';

jest.mock('@/utils/storage', () => ({
  appStorage: {
    getLanguage: jest.fn(),
    setLanguage: jest.fn(),
  },
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    clearAll: jest.fn(),
  },
}));

jest.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: ['en', 'fr', 'pt'],
  changeLanguage: jest.fn().mockResolvedValue(undefined),
  language: 'en',
  default: {
    changeLanguage: jest.fn().mockResolvedValue(undefined),
    language: 'en',
  },
}));

describe('languageStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useLanguageStore.setState({ currentLanguage: 'en' });
    });
  });

  describe('initial state', () => {
    it('has english as default language', () => {
      const state = useLanguageStore.getState();
      expect(state.currentLanguage).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('updates currentLanguage to french', async () => {
      const { setLanguage } = useLanguageStore.getState();

      await act(async () => {
        await setLanguage('fr');
      });

      expect(useLanguageStore.getState().currentLanguage).toBe('fr');
    });

    it('updates currentLanguage to portuguese', async () => {
      const { setLanguage } = useLanguageStore.getState();

      await act(async () => {
        await setLanguage('pt');
      });

      expect(useLanguageStore.getState().currentLanguage).toBe('pt');
    });

    it('persists language to storage', async () => {
      const { setLanguage } = useLanguageStore.getState();

      await act(async () => {
        await setLanguage('fr');
      });

      expect(appStorage.setLanguage).toHaveBeenCalledWith('fr');
    });

    it('calls i18n.changeLanguage with the new language', async () => {
      const { setLanguage } = useLanguageStore.getState();

      await act(async () => {
        await setLanguage('pt');
      });

      expect(i18n.changeLanguage).toHaveBeenCalledWith('pt');
    });
  });

  describe('hydrateFromStorage', () => {
    it('restores persisted language from storage', async () => {
      (appStorage.getLanguage as jest.Mock).mockReturnValue('fr');
      const { hydrateFromStorage } = useLanguageStore.getState();

      await act(async () => {
        await hydrateFromStorage();
      });

      expect(useLanguageStore.getState().currentLanguage).toBe('fr');
    });

    it('keeps english default when no stored language', async () => {
      (appStorage.getLanguage as jest.Mock).mockReturnValue(undefined);
      const { hydrateFromStorage } = useLanguageStore.getState();

      await act(async () => {
        await hydrateFromStorage();
      });

      expect(useLanguageStore.getState().currentLanguage).toBe('en');
    });

    it('ignores unsupported stored language values', async () => {
      (appStorage.getLanguage as jest.Mock).mockReturnValue('zh');
      const { hydrateFromStorage } = useLanguageStore.getState();

      await act(async () => {
        await hydrateFromStorage();
      });

      expect(useLanguageStore.getState().currentLanguage).toBe('en');
    });
  });
});
