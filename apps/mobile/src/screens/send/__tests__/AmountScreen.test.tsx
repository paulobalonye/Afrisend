import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AmountScreen } from '../AmountScreen';
import * as yellowcard from '@/api/endpoints/yellowcard';
import * as recipientsApi from '@/api/endpoints/recipients';

jest.mock('@/api/endpoints/yellowcard');
jest.mock('@/api/endpoints/recipients');
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C47FF',
      background: '#FFFFFF',
      surface: '#F8F7FF',
      border: '#E5E1FF',
      text: '#1A1033',
      textSecondary: '#6B7280',
      success: '#10B981',
      error: '#EF4444',
      accent: '#F59E0B',
    },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: { recipientId: 'r1' } }),
}));

const mockRecipient = {
  id: 'r1',
  userId: 'u1',
  nickname: 'Mom',
  firstName: 'Adaeze',
  lastName: 'Okafor',
  country: 'NG',
  payoutMethod: 'bank_transfer' as const,
  accountDetails: { accountNumber: '1234567890', bankCode: 'GTB', bankName: 'GTBank' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCorridor = {
  id: 'corridor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  destinationCountry: 'NG',
  destinationCountryName: 'Nigeria',
  minAmount: 10,
  maxAmount: 5000,
  isActive: true,
  refreshIntervalSeconds: 60,
};

const mockQuote = {
  corridorId: 'corridor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 180000,
  exchangeRate: 1800,
  fee: 2.5,
  totalSourceAmount: 102.5,
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  quoteId: 'q1',
};

describe('AmountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recipientsApi.getRecipient as jest.Mock).mockResolvedValue(mockRecipient);
    (yellowcard.listSupportedCorridors as jest.Mock).mockResolvedValue([mockCorridor]);
    (yellowcard.getRates as jest.Mock).mockResolvedValue(mockQuote);
  });

  it('renders amount input and corridor selector', async () => {
    const { getByTestId } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());
  });

  it('shows FX quote after entering a valid amount', async () => {
    const { getByTestId, getByText } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '100');
    await waitFor(() => expect(getByText('180,000')).toBeTruthy());
  });

  it('displays exchange rate and fee in quote breakdown', async () => {
    const { getByTestId, getByText } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '100');
    await waitFor(() => {
      expect(getByText(/1,800/)).toBeTruthy();
      expect(getByText(/2\.50/)).toBeTruthy();
    });
  });

  it('shows rate countdown timer when quote is loaded', async () => {
    const { getByTestId, getByText } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '100');
    await waitFor(() => expect(getByTestId('quote-countdown')).toBeTruthy());
  });

  it('disables Next button until amount is entered and quote is fetched', async () => {
    const { getByTestId } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    const nextBtn = getByTestId('next-button');
    expect(nextBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables Next button when amount and quote are ready', async () => {
    const { getByTestId } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '100');
    await waitFor(() => {
      const nextBtn = getByTestId('next-button');
      expect(nextBtn.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it('shows minimum amount error when amount is below minimum', async () => {
    const { getByTestId, getByText } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '5');
    await waitFor(() => expect(getByText(/Minimum/)).toBeTruthy());
  });

  it('navigates to payment method screen on Next press', async () => {
    const { getByTestId } = render(<AmountScreen />);
    await waitFor(() => expect(getByTestId('amount-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('amount-input'), '100');
    await waitFor(() => {
      const nextBtn = getByTestId('next-button');
      expect(nextBtn.props.accessibilityState?.disabled).toBeFalsy();
    });

    fireEvent.press(getByTestId('next-button'));
    expect(mockNavigate).toHaveBeenCalledWith('SendPaymentMethod');
  });
});
