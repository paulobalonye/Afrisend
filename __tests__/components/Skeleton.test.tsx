import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Skeleton,
  TransactionRowSkeleton,
  RecipientRowSkeleton,
  ListSkeleton,
} from '../../src/components/ui/Skeleton';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('Skeleton', () => {
  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <Skeleton testID="skeleton-1" />,
    );
    expect(getByTestId('skeleton-1')).toBeTruthy();
  });

  it('renders with custom dimensions without error', () => {
    expect(() =>
      renderWithTheme(<Skeleton width={200} height={24} borderRadius={8} />),
    ).not.toThrow();
  });
});

describe('TransactionRowSkeleton', () => {
  it('renders without error', () => {
    expect(() =>
      renderWithTheme(<TransactionRowSkeleton />),
    ).not.toThrow();
  });
});

describe('RecipientRowSkeleton', () => {
  it('renders without error', () => {
    expect(() =>
      renderWithTheme(<RecipientRowSkeleton />),
    ).not.toThrow();
  });
});

describe('ListSkeleton', () => {
  it('renders default count of 5 items without error', () => {
    expect(() => renderWithTheme(<ListSkeleton />)).not.toThrow();
  });

  it('renders specified count of items', () => {
    expect(() => renderWithTheme(<ListSkeleton count={3} />)).not.toThrow();
  });

  it('renders recipient type', () => {
    expect(() =>
      renderWithTheme(<ListSkeleton type="recipient" count={4} />),
    ).not.toThrow();
  });
});
