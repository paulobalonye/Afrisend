import React from 'react';

const TIER_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-green-100 text-green-800',
};

type Props = { tier: number };

export function KycTierBadge({ tier }: Props) {
  const className = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      Tier {tier}
    </span>
  );
}
