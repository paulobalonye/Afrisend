import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { KycIntroScreen } from '../../src/screens/kyc/KycIntroScreen';
import { ThemeProvider } from '../../src/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../src/api/endpoints/kyc', () => ({
  startKycSession: jest.fn(),
}));

jest.mock('../../src/store/kycStore', () => ({
  useKycStore: () => ({
    setSession: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

function renderKycIntro() {
  return render(
    <ThemeProvider>
      <KycIntroScreen />
    </ThemeProvider>,
  );
}

describe('KycIntroScreen', () => {
  it('renders the start verification button', () => {
    const { getByTestId } = renderKycIntro();
    expect(getByTestId('start-kyc-button')).toBeTruthy();
  });

  it('calls startKycSession when start button pressed', async () => {
    const { startKycSession } = require('../../src/api/endpoints/kyc');
    startKycSession.mockResolvedValueOnce({
      sessionId: 'kyc-session-1',
      status: 'pending',
      tier: 2,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { getByTestId } = renderKycIntro();
    fireEvent.press(getByTestId('start-kyc-button'));

    await waitFor(() => {
      expect(startKycSession).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the three KYC steps', () => {
    const { getByText } = renderKycIntro();
    expect(getByText('kyc.intro.steps.id')).toBeTruthy();
    expect(getByText('kyc.intro.steps.selfie')).toBeTruthy();
    expect(getByText('kyc.intro.steps.address')).toBeTruthy();
  });
});
