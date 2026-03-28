import React from 'react';
import { render } from '@testing-library/react-native';
import { AmountDisplay, formatCurrencyAmount } from '../../src/components/ui/AmountDisplay';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('formatCurrencyAmount', () => {
  it('returns NGN symbol ₦', () => {
    const { symbol } = formatCurrencyAmount(5000, 'NGN');
    expect(symbol).toBe('₦');
  });

  it('returns GHS symbol ₵', () => {
    const { symbol } = formatCurrencyAmount(100, 'GHS');
    expect(symbol).toBe('₵');
  });

  it('formats amount with two decimal places', () => {
    const { formatted } = formatCurrencyAmount(1234.5, 'NGN');
    expect(formatted).toContain('1,234.50');
  });

  it('handles negative amounts (absolute value in formatted)', () => {
    const { formatted } = formatCurrencyAmount(-500, 'NGN');
    expect(formatted).toContain('500.00');
  });

  it('falls back to currency code as symbol for unknown currency', () => {
    const { symbol } = formatCurrencyAmount(100, 'XYZ');
    expect(symbol).toBe('XYZ');
  });
});

describe('AmountDisplay', () => {
  it('renders without error', () => {
    expect(() =>
      renderWithTheme(<AmountDisplay amount={5000} currency="NGN" />),
    ).not.toThrow();
  });

  it('renders currency symbol when showSymbol is true', () => {
    const { getByText } = renderWithTheme(
      <AmountDisplay amount={100} currency="NGN" showSymbol />,
    );
    expect(getByText('₦')).toBeTruthy();
  });

  it('does not render symbol when showSymbol is false', () => {
    const { queryByText } = renderWithTheme(
      <AmountDisplay amount={100} currency="NGN" showSymbol={false} />,
    );
    expect(queryByText('₦')).toBeNull();
  });

  it('renders currency code when showCode is true', () => {
    const { getByText } = renderWithTheme(
      <AmountDisplay amount={100} currency="NGN" showCode />,
    );
    expect(getByText('NGN')).toBeTruthy();
  });

  it('renders negative sign for negative amounts', () => {
    const { getByText } = renderWithTheme(
      <AmountDisplay amount={-200} currency="NGN" showSymbol />,
    );
    expect(getByText('-₦')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <AmountDisplay amount={100} currency="NGN" testID="amount" />,
    );
    expect(getByTestId('amount')).toBeTruthy();
  });

  it('renders all sizes without error', () => {
    const sizes: Array<'sm' | 'md' | 'lg' | 'xl'> = ['sm', 'md', 'lg', 'xl'];
    for (const size of sizes) {
      expect(() =>
        renderWithTheme(<AmountDisplay amount={1000} currency="NGN" size={size} />),
      ).not.toThrow();
    }
  });
});
