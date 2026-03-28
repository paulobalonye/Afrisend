import { render, screen } from '@testing-library/react';
import { TransactionStatusBadge } from '@/components/ui/TransactionStatusBadge';
import type { PaymentStatus } from '@/types';

const cases: { status: PaymentStatus; label: string; partialClass: string }[] = [
  { status: 'completed', label: 'Completed', partialClass: 'green' },
  { status: 'pending', label: 'Pending', partialClass: 'yellow' },
  { status: 'processing', label: 'Processing', partialClass: 'blue' },
  { status: 'failed', label: 'Failed', partialClass: 'red' },
  { status: 'cancelled', label: 'Cancelled', partialClass: 'gray' },
];

describe('TransactionStatusBadge', () => {
  it.each(cases)('should render $status badge with correct label', ({ status, label }) => {
    render(<TransactionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(cases)('should apply colour class for $status', ({ status, partialClass }) => {
    const { container } = render(<TransactionStatusBadge status={status} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain(partialClass);
  });
});
