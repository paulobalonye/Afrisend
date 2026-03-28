import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipientCard, Recipient } from '../../src/components/ui/RecipientCard';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

const baseRecipient: Recipient = {
  id: 'r-1',
  firstName: 'Amina',
  lastName: 'Diallo',
  country: 'NG',
  institutionName: 'GTBank',
  accountIdentifier: '0123456789',
  paymentMethod: 'bank_transfer',
};

describe('RecipientCard', () => {
  it('renders recipient full name', () => {
    const { getByText } = renderWithTheme(<RecipientCard recipient={baseRecipient} />);
    expect(getByText('Amina Diallo')).toBeTruthy();
  });

  it('renders institution name', () => {
    const { getByText } = renderWithTheme(<RecipientCard recipient={baseRecipient} />);
    expect(getByText('GTBank')).toBeTruthy();
  });

  it('renders account identifier', () => {
    const { getByText } = renderWithTheme(<RecipientCard recipient={baseRecipient} />);
    expect(getByText('0123456789')).toBeTruthy();
  });

  it('renders initials in avatar', () => {
    const { getByText } = renderWithTheme(<RecipientCard recipient={baseRecipient} />);
    expect(getByText('AD')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <RecipientCard recipient={baseRecipient} onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders selected state without error', () => {
    expect(() =>
      renderWithTheme(<RecipientCard recipient={baseRecipient} selected />),
    ).not.toThrow();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <RecipientCard recipient={baseRecipient} testID="recipient-1" />,
    );
    expect(getByTestId('recipient-1')).toBeTruthy();
  });

  it('renders without optional fields', () => {
    const minimal: Recipient = { id: 'r-2', firstName: 'John', lastName: 'Doe' };
    expect(() => renderWithTheme(<RecipientCard recipient={minimal} />)).not.toThrow();
  });
});
