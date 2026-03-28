'use client';

import type { PaymentStatus } from '@/types';

type Props = { status: PaymentStatus };

const config: Record<PaymentStatus, { label: string; classes: string }> = {
  completed: { label: 'Completed', classes: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', classes: 'bg-blue-100 text-blue-800' },
  failed: { label: 'Failed', classes: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
};

export function TransactionStatusBadge({ status }: Props) {
  const { label, classes } = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
