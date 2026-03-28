import React from 'react';
import { render } from '@testing-library/react-native';
import { StatusIndicator, TransactionStatus, KycStatus } from '../../src/components/ui/StatusIndicator';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

const transactionStatuses: TransactionStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
];

const kycStatuses: KycStatus[] = [
  'not_started',
  'in_progress',
  'pending_review',
  'approved',
  'rejected',
];

describe('StatusIndicator', () => {
  it('renders label for completed status', () => {
    const { getByText } = renderWithTheme(
      <StatusIndicator status="completed" />,
    );
    expect(getByText('Completed')).toBeTruthy();
  });

  it('renders label for approved KYC status', () => {
    const { getByText } = renderWithTheme(
      <StatusIndicator status="approved" />,
    );
    expect(getByText('Verified')).toBeTruthy();
  });

  it('does not show label when showLabel is false', () => {
    const { queryByText } = renderWithTheme(
      <StatusIndicator status="completed" showLabel={false} />,
    );
    expect(queryByText('Completed')).toBeNull();
  });

  it('renders all transaction statuses without error', () => {
    for (const status of transactionStatuses) {
      expect(() =>
        renderWithTheme(<StatusIndicator status={status} />),
      ).not.toThrow();
    }
  });

  it('renders all KYC statuses without error', () => {
    for (const status of kycStatuses) {
      expect(() =>
        renderWithTheme(<StatusIndicator status={status} />),
      ).not.toThrow();
    }
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <StatusIndicator status="pending" testID="status-ind" />,
    );
    expect(getByTestId('status-ind')).toBeTruthy();
  });
});
