import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SelectRecipientScreen } from '../SelectRecipientScreen';
import * as recipientsApi from '@/api/endpoints/recipients';

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
  useRoute: () => ({ params: {} }),
}));

const mockRecipients = [
  {
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
  },
  {
    id: 'r2',
    userId: 'u1',
    nickname: 'Brother',
    firstName: 'Emeka',
    lastName: 'Okafor',
    country: 'GH',
    payoutMethod: 'mobile_money' as const,
    accountDetails: { phone: '+233244123456', network: 'MTN' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('SelectRecipientScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recipientsApi.getRecipients as jest.Mock).mockResolvedValue(mockRecipients);
  });

  it('renders title and loading state initially', () => {
    const { getByText, getByTestId } = render(<SelectRecipientScreen />);
    expect(getByText('Select recipient')).toBeTruthy();
    expect(getByTestId('loading-skeleton')).toBeTruthy();
  });

  it('renders list of recipients after loading', async () => {
    const { getByText, queryByTestId } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(queryByTestId('loading-skeleton')).toBeNull());
    expect(getByText('Mom')).toBeTruthy();
    expect(getByText('Brother')).toBeTruthy();
  });

  it('filters recipients by search query', async () => {
    const { getByTestId, getByText, queryByText } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(queryByText('Mom')).toBeTruthy());

    fireEvent.changeText(getByTestId('recipient-search-input'), 'Mom');
    expect(getByText('Mom')).toBeTruthy();
    expect(queryByText('Brother')).toBeNull();
  });

  it('shows empty state when no recipients match search', async () => {
    const { getByTestId, queryByText, getByText } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(queryByText('Mom')).toBeTruthy());

    fireEvent.changeText(getByTestId('recipient-search-input'), 'xyz-nobody');
    expect(getByText('No recipients found')).toBeTruthy();
  });

  it('shows empty state when no saved recipients', async () => {
    (recipientsApi.getRecipients as jest.Mock).mockResolvedValue([]);
    const { getByText } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(getByText('No saved recipients yet')).toBeTruthy());
  });

  it('navigates to amount screen when recipient is selected', async () => {
    const { getByText, queryByTestId } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(queryByTestId('loading-skeleton')).toBeNull());

    fireEvent.press(getByText('Mom'));
    expect(mockNavigate).toHaveBeenCalledWith('SendAmount', { recipientId: 'r1' });
  });

  it('shows add new recipient button', async () => {
    const { getByTestId } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(getByTestId('add-recipient-button')).toBeTruthy());
    fireEvent.press(getByTestId('add-recipient-button'));
    expect(mockNavigate).toHaveBeenCalledWith('AddRecipient');
  });

  it('shows error state when API fails', async () => {
    (recipientsApi.getRecipients as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<SelectRecipientScreen />);
    await waitFor(() => expect(getByText('Something went wrong')).toBeTruthy());
  });
});
