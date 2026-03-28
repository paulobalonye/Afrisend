import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../src/components/ui/Button';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('Button', () => {
  it('renders the label', () => {
    const { getByText } = renderWithTheme(
      <Button label="Click me" onPress={() => {}} />,
    );
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <Button label="Tap" onPress={onPress} testID="btn" />,
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <Button label="Disabled" onPress={onPress} disabled testID="btn" />,
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <Button label="Loading" onPress={onPress} loading testID="btn" />,
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows activity indicator when loading', () => {
    const { getByTestId, queryByText } = renderWithTheme(
      <Button label="Loading" onPress={() => {}} loading testID="btn" />,
    );
    expect(queryByText('Loading')).toBeNull();
  });

  it('renders with accessibility role button', () => {
    const { getByRole } = renderWithTheme(
      <Button label="Accessible" onPress={() => {}} />,
    );
    expect(getByRole('button')).toBeTruthy();
  });
});
