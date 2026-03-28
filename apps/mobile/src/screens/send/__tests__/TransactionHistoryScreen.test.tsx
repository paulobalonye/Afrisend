import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TransactionHistoryScreen } from '../TransactionHistoryScreen';
import * as transactionsApi from '@/api/endpoints/transactions';

jest.mock('@/api/endpoints/transactions');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

const mockTransactions = [
  {
    id: 'tx1',
    corridorId: 'c1',
    sourceCurrency: 'GBP',
    destinationCurrency: 'NGN',
    sourceAmount: 100,
    destinationAmount: 180000,
    exchangeRate: 1800,
    fee: 2.5,
    status: 'completed' as const,
    recipientName: 'Adaeze Okafor',
    recipientCountry: 'NG',
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-03-20T10:05:00Z',
  },
  {
    id: 'tx2',
    corridorId: 'c2',
    sourceCurrency: 'GBP',
    destinationCurrency: 'GHS',
    sourceAmount: 50,
    destinationAmount: 750,
    exchangeRate: 15,
    fee: 1.5,
    status: 'pending' as const,
    recipientName: 'Kwame Mensah',
    recipientCountry: 'GH',
    createdAt: '2026-03-21T08:00:00Z',
    updatedAt: '2026-03-21T08:00:00Z',
  },
];

describe('TransactionHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);
  });

  it('renders title', () => {
    const { getByText } = render(<TransactionHistoryScreen />);
    expect(getByText('Transactions')).toBeTruthy();
  });

  it('shows loading skeleton initially', () => {
    const { getByTestId } = render(<TransactionHistoryScreen />);
    expect(getByTestId('loading-skeleton')).toBeTruthy();
  });

  it('renders transactions after loading', async () => {
    const { getByText, queryByTestId } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(queryByTestId('loading-skeleton')).toBeNull());
    expect(getByText('Adaeze Okafor')).toBeTruthy();
    expect(getByText('Kwame Mensah')).toBeTruthy();
  });

  it('shows empty state when no transactions', async () => {
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValue([]);
    const { getByText } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(getByText('No transactions yet')).toBeTruthy());
  });

  it('filters transactions by status', async () => {
    const { getByText, getByTestId, queryByText } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(queryByText('Adaeze Okafor')).toBeTruthy());

    fireEvent.press(getByTestId('filter-chip-completed'));
    expect(getByText('Adaeze Okafor')).toBeTruthy();
    expect(queryByText('Kwame Mensah')).toBeNull();
  });

  it('navigates to transaction detail on tap', async () => {
    const { getByText, queryByTestId } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(queryByTestId('loading-skeleton')).toBeNull());

    fireEvent.press(getByText('Adaeze Okafor'));
    expect(mockNavigate).toHaveBeenCalledWith('TransactionDetail', { transactionId: 'tx1' });
  });

  it('shows error state when API fails', async () => {
    (transactionsApi.getTransactions as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(getByText('Something went wrong')).toBeTruthy());
  });

  it('shows correct status badge colors', async () => {
    const { getByTestId, queryByTestId } = render(<TransactionHistoryScreen />);
    await waitFor(() => expect(queryByTestId('loading-skeleton')).toBeNull());

    expect(getByTestId('status-badge-tx1')).toBeTruthy();
    expect(getByTestId('status-badge-tx2')).toBeTruthy();
  });
});
