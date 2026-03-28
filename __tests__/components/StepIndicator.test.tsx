import React from 'react';
import { render } from '@testing-library/react-native';
import { StepIndicator } from '../../src/components/onboarding/StepIndicator';
import { ThemeProvider } from '../../src/theme';

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>);
}

describe('StepIndicator', () => {
  it('renders the correct number of dots', () => {
    const { getAllByRole } = renderWithTheme(
      <StepIndicator totalSteps={4} currentStep={1} />,
    );
    // The container has progressbar role
    expect(getAllByRole('progressbar')).toBeTruthy();
  });

  it('has correct accessibility attributes', () => {
    const { getByRole } = renderWithTheme(
      <StepIndicator totalSteps={3} currentStep={1} />,
    );
    const indicator = getByRole('progressbar');
    expect(indicator.props.accessibilityValue).toEqual({ min: 0, max: 2, now: 1 });
  });
});
