import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReviewConfirmScreen } from '../ReviewConfirmScreen';
import * as yellowcard from '@/api/endpoints/yellowcard';
import { useRemittanceStore } from '@/store/remittanceStore';

jest.mock('@/api/endpoints/yellowcard');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

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

const mockRecipient = {
  name: 'Adaeze Okafor',
  accountNumber: '1234567890',
  bankCode: 'GTB',
  bankName: 'GTBank',
};

const mockPayment = {
  id: 'pay-1',
  idempotencyKey: 'idem-1',
  corridorId: 'corridor-1',
  sourceCurrency: 'GBP',
  destinationCurrency: 'NGN',
  sourceAmount: 100,
  destinationAmount: 180000,
  exchangeRate: 1800,
  fee: 2.5,
  status: 'pending' as const,
  recipient: mockRecipient,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ReviewConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Seed store with quote and recipient
    useRemittanceStore.setState({
      currentQuote: mockQuote,
      recipient: mockRecipient,
      selectedCorridor: {
        id: 'corridor-1',
        sourceCurrency: 'GBP',
        destinationCurrency: 'NGN',
        destinationCountry: 'NG',
        destinationCountryName: 'Nigeria',
        minAmount: 10,
        maxAmount: 5000,
        isActive: true,
        refreshIntervalSeconds: 60,
      },
    } as any);
    (yellowcard.initiatePayment as jest.Mock).mockResolvedValue(mockPayment);
  });

  it('renders summary with correct amounts', () => {
    const { getByText } = render(<ReviewConfirmScreen />);
    expect(getByText(/100/)).toBeTruthy();
    expect(getByText(/180,000/)).toBeTruthy();
    expect(getByText('Adaeze Okafor')).toBeTruthy();
  });

  it('shows exchange rate and fee', () => {
    const { getByText } = render(<ReviewConfirmScreen />);
    expect(getByText(/1,800/)).toBeTruthy();
    expect(getByText(/2\.50/)).toBeTruthy();
  });

  it('does not submit when terms not agreed (confirm button is disabled)', async () => {
    const { getByTestId } = render(<ReviewConfirmScreen />);
    // Pressing confirm without checking terms should not trigger initiatePayment
    fireEvent.press(getByTestId('confirm-button'));
    await new Promise((r) => setTimeout(r, 50));
    expect(yellowcard.initiatePayment).not.toHaveBeenCalled();
  });

  it('enables confirm button after agreeing to terms', () => {
    const { getByTestId } = render(<ReviewConfirmScreen />);
    fireEvent.press(getByTestId('terms-checkbox'));
    const confirmBtn = getByTestId('confirm-button');
    // After agreeing, the button is enabled (disabled prop is false or undefined)
    expect(confirmBtn.props.disabled).toBeFalsy();
  });

  it('calls initiatePayment and navigates to processing on confirm', async () => {
    const { getByTestId } = render(<ReviewConfirmScreen />);
    fireEvent.press(getByTestId('terms-checkbox'));
    fireEvent.press(getByTestId('confirm-button'));

    await waitFor(() => {
      expect(yellowcard.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          quoteId: 'q1',
          corridorId: 'corridor-1',
          sourceCurrency: 'USDC',
          sourceAmount: 100,
          recipient: mockRecipient,
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('SendProcessing');
    });
  });

  it('shows error when initiatePayment fails', async () => {
    (yellowcard.initiatePayment as jest.Mock).mockRejectedValueOnce(
      new Error('Payment failed'),
    );

    const { getByTestId, getByText } = render(<ReviewConfirmScreen />);
    fireEvent.press(getByTestId('terms-checkbox'));
    fireEvent.press(getByTestId('confirm-button'));

    await waitFor(() => expect(getByText(/Payment failed/)).toBeTruthy());
  });
});
