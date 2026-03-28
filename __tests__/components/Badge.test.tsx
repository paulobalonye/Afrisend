import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '../../src/components/ui/Badge';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('Badge', () => {
  it('renders the label', () => {
    const { getByText } = renderWithTheme(<Badge label="Verified" />);
    expect(getByText('Verified')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(<Badge label="Test" testID="badge-test" />);
    expect(getByTestId('badge-test')).toBeTruthy();
  });

  it('renders all variants without error', () => {
    const variants: Array<'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'> = [
      'primary',
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ];
    for (const variant of variants) {
      expect(() =>
        renderWithTheme(<Badge label={variant} variant={variant} />),
      ).not.toThrow();
    }
  });

  it('renders sm and md sizes without error', () => {
    expect(() => renderWithTheme(<Badge label="Small" size="sm" />)).not.toThrow();
    expect(() => renderWithTheme(<Badge label="Medium" size="md" />)).not.toThrow();
  });
});
