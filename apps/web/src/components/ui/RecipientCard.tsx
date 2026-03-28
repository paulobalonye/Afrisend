'use client';

import type { Recipient } from '@/types';

const COUNTRY_NAMES: Record<string, string> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  ZA: 'South Africa',
  ZM: 'Zambia',
};

type Props = {
  recipient: Recipient;
  onSelect?: (recipient: Recipient) => void;
  onEdit?: (recipient: Recipient) => void;
  onDelete?: (id: string) => void;
  selected?: boolean;
};

export function RecipientCard({ recipient, onSelect, onEdit, onDelete, selected }: Props) {
  const countryName = COUNTRY_NAMES[recipient.country] ?? recipient.country;

  const bankName =
    recipient.payoutMethod === 'bank_transfer'
      ? (recipient.accountDetails as { bankName: string }).bankName
      : (recipient.accountDetails as { network: string }).network;

  return (
    <div className={`rounded-xl border p-4 ${selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onSelect?.(recipient)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
            {recipient.firstName[0]}
            {recipient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{recipient.nickname}</p>
            <p className="text-sm text-gray-600 truncate">
              {recipient.firstName} {recipient.lastName}
            </p>
            <p className="text-xs text-gray-500">{countryName} · {bankName}</p>
          </div>
        </div>
      </button>

      {(onEdit || onDelete) && (
        <div className="mt-3 flex gap-2 justify-end">
          {onEdit && (
            <button
              type="button"
              aria-label="Edit recipient"
              onClick={() => onEdit(recipient)}
              className="text-xs text-brand-600 hover:text-brand-800 px-2 py-1 rounded"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete recipient"
              onClick={() => onDelete(recipient.id)}
              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
