import React from 'react';
import type { AccountStatus } from '@/lib/api/admin';

const CONFIG: Record<AccountStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700' },
};

type Props = { status: AccountStatus };

export function AdminStatusBadge({ status }: Props) {
  const { label, className } = CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
