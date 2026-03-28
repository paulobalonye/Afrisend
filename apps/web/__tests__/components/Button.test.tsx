import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('should render with label', () => {
    render(<Button label="Send Money" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Send Money' })).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button label="Click me" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button label="Disabled" onClick={() => {}} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<Button label="Disabled" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should show loading spinner when isLoading', () => {
    render(<Button label="Loading" onClick={() => {}} isLoading />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
  });

  it('should render full-width when fullWidth is true', () => {
    render(<Button label="Full" onClick={() => {}} fullWidth />);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('should apply variant styles', () => {
    const { rerender } = render(<Button label="Primary" onClick={() => {}} variant="primary" />);
    expect(screen.getByRole('button')).toHaveClass('bg-brand-500');

    rerender(<Button label="Secondary" onClick={() => {}} variant="secondary" />);
    expect(screen.getByRole('button')).toHaveClass('border-brand-500');
  });
});
