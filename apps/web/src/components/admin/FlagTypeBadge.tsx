import React from 'react';
import type { FlagType } from '@/lib/api/admin';

const CONFIG: Record<FlagType, { label: string; className: string }> = {
  aml_alert: { label: 'AML Alert', className: 'bg-orange-100 text-orange-800' },
  sanctions_hit: { label: 'Sanctions Hit', className: 'bg-red-100 text-red-800' },
  manual_review: { label: 'Manual Review', className: 'bg-yellow-100 text-yellow-800' },
  high_risk: { label: 'High Risk', className: 'bg-purple-100 text-purple-800' },
};

type Props = { flagType: FlagType };

export function FlagTypeBadge({ flagType }: Props) {
  const { label, className } = CONFIG[flagType] ?? { label: flagType, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
