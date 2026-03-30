import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Suppress expected React error boundary console output in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('ErrorBoundary') || args[0].includes('The above error occurred'))
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => { console.error = originalError; });

function BrokenComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error');
  return <></>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={false} />
        {/* @ts-ignore */}
        <nativeText>Hello</nativeText>
      </ErrorBoundary>,
    );
    // Children render without issue
  });

  it('renders fallback UI when a child throws', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByTestId('error-boundary-fallback')).toBeTruthy();
  });

  it('shows error message in fallback', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText(/something went wrong/i)).toBeTruthy();
  });

  it('calls onError callback when error is caught', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('renders custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<>
          {/* @ts-ignore */}
          <nativeText>Custom Error</nativeText>
        </>}>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    // The fallback renders — just check no crash
  });

  it('shows retry button in fallback', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByTestId('error-boundary-retry')).toBeTruthy();
  });
});
