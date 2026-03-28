import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';
import { useLanguageStore } from '@/store/languageStore';
import { act } from 'react-test-renderer';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: jest.fn(),
}));

const mockSetLanguage = jest.fn().mockResolvedValue(undefined);

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLanguageStore as unknown as jest.Mock).mockReturnValue({
      currentLanguage: 'en',
      setLanguage: mockSetLanguage,
    });
  });

  it('renders the settings title', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders the language section label', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Language')).toBeTruthy();
  });

  it('renders all three language options', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('English')).toBeTruthy();
    expect(getByText('Français')).toBeTruthy();
    expect(getByText('Português')).toBeTruthy();
  });

  it('shows the current language as selected', () => {
    (useLanguageStore as unknown as jest.Mock).mockReturnValue({
      currentLanguage: 'fr',
      setLanguage: mockSetLanguage,
    });

    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('language-option-fr-selected')).toBeTruthy();
  });

  it('calls setLanguage when a language option is pressed', async () => {
    const { getByTestId } = render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('language-option-fr'));
    });

    expect(mockSetLanguage).toHaveBeenCalledWith('fr');
  });

  it('does not call setLanguage when already selected language is pressed', async () => {
    const { getByTestId } = render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('language-option-en'));
    });

    expect(mockSetLanguage).not.toHaveBeenCalled();
  });

  it('renders back/close navigation control', () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('settings-back-button')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId('settings-back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
