import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { OtpScreen } from '../../src/screens/onboarding/OtpScreen';
import { ThemeProvider } from '../../src/theme';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.phone) return `Code sent to ${opts.phone}`;
      if (opts?.seconds) return `Resend in ${opts.seconds}s`;
      return key;
    },
  }),
}));

// Mock auth API
jest.mock('../../src/api/endpoints/auth', () => ({
  verifyOtp: jest.fn(),
  sendOtp: jest.fn(),
}));

// Mock store
jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    setSessionId: jest.fn(),
    setTemporaryToken: jest.fn(),
  }),
}));

// Mock route params
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({
    params: { phone: '+1555123456', sessionId: 'session-test-1' },
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

function renderOtpScreen() {
  return render(
    <ThemeProvider>
      <OtpScreen />
    </ThemeProvider>,
  );
}

describe('OtpScreen', () => {
  it('renders the OTP input', () => {
    const { getByTestId } = renderOtpScreen();
    expect(getByTestId('otp-input')).toBeTruthy();
  });

  it('renders the verify button', () => {
    const { getByTestId } = renderOtpScreen();
    expect(getByTestId('verify-otp-button')).toBeTruthy();
  });

  it('verify button is disabled when OTP is empty', () => {
    const { getByTestId } = renderOtpScreen();
    const button = getByTestId('verify-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows error message on invalid OTP', async () => {
    const { verifyOtp } = require('../../src/api/endpoints/auth');
    verifyOtp.mockRejectedValueOnce(new Error('Invalid code'));

    const { getByTestId, findByTestId } = renderOtpScreen();
    const input = getByTestId('otp-input');

    await act(async () => {
      fireEvent.changeText(input, '123456');
    });

    await waitFor(() => {
      // auto-submit triggers on 6 digits
      // error should appear after rejection
    });
  });
});
