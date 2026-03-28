import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransactionRow, Transaction } from '../../src/components/ui/TransactionRow';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

const baseTransaction: Transaction = {
  id: 'txn-1',
  recipientName: 'Kwame Mensah',
  recipientCountry: 'GH',
  sendAmount: 50000,
  sendCurrency: 'NGN',
  receiveAmount: 235.4,
  receiveCurrency: 'GHS',
  status: 'completed',
  createdAt: new Date('2026-03-01T10:00:00Z'),
};

describe('TransactionRow', () => {
  it('renders recipient name', () => {
    const { getByText } = renderWithTheme(<TransactionRow transaction={baseTransaction} />);
    expect(getByText('Kwame Mensah')).toBeTruthy();
  });

  it('renders status indicator label', () => {
    const { getByText } = renderWithTheme(<TransactionRow transaction={baseTransaction} />);
    expect(getByText('Completed')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <TransactionRow transaction={baseTransaction} onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress as static view', () => {
    const { queryByRole } = renderWithTheme(
      <TransactionRow transaction={baseTransaction} />,
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('renders failed transaction without error', () => {
    const failed: Transaction = { ...baseTransaction, status: 'failed' };
    expect(() => renderWithTheme(<TransactionRow transaction={failed} />)).not.toThrow();
  });

  it('renders refunded transaction without error', () => {
    const refunded: Transaction = { ...baseTransaction, status: 'refunded' };
    expect(() => renderWithTheme(<TransactionRow transaction={refunded} />)).not.toThrow();
  });

  it('renders without optional receiveAmount', () => {
    const noReceive: Transaction = {
      ...baseTransaction,
      receiveAmount: undefined,
      receiveCurrency: undefined,
    };
    expect(() => renderWithTheme(<TransactionRow transaction={noReceive} />)).not.toThrow();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <TransactionRow transaction={baseTransaction} testID="txn-row" />,
    );
    expect(getByTestId('txn-row')).toBeTruthy();
  });
});
