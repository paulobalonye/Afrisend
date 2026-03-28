import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Card } from '../../src/components/ui/Card';
import { ThemeProvider } from '../../src/theme';
import { Typography } from '../../src/components/ui/Typography';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = renderWithTheme(
      <Card>
        <Typography>Card content</Typography>
      </Card>,
    );
    expect(getByText('Card content')).toBeTruthy();
  });

  it('renders as a touchable when onPress is provided', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Card onPress={onPress} accessibilityLabel="Tap card">
        <Typography>Pressable</Typography>
      </Card>,
    );
    const btn = getByRole('button');
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when no handler provided', () => {
    const { queryByRole } = renderWithTheme(
      <Card>
        <Typography>Static card</Typography>
      </Card>,
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(
      <Card testID="my-card">
        <Typography>Test</Typography>
      </Card>,
    );
    expect(getByTestId('my-card')).toBeTruthy();
  });

  it('renders variants without error', () => {
    const variants: Array<'default' | 'outlined' | 'elevated' | 'flat'> = [
      'default',
      'outlined',
      'elevated',
      'flat',
    ];
    for (const variant of variants) {
      expect(() =>
        renderWithTheme(
          <Card variant={variant}>
            <Typography>{variant}</Typography>
          </Card>,
        ),
      ).not.toThrow();
    }
  });
});
