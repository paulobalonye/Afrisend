'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './Button';
import { createRecipient, updateRecipient } from '@/lib/api/recipients';
import type { Recipient } from '@/types';

const schema = z.object({
  nickname: z.string().min(1, 'Nickname is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  country: z.string().min(2, 'Country is required'),
  payoutMethod: z.enum(['bank_transfer', 'mobile_money']),
  bankName: z.string().optional(),
  bankCode: z.string().optional(),
  accountNumber: z.string().optional(),
  phone: z.string().optional(),
  network: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  recipient: Recipient | null;
  onClose: () => void;
};

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'ZA', name: 'South Africa' },
];

export function RecipientForm({ recipient, onClose }: Props) {
  const isEdit = !!recipient;
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues: Partial<FormValues> = recipient
    ? {
        nickname: recipient.nickname,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        country: recipient.country,
        payoutMethod: recipient.payoutMethod,
        ...(recipient.payoutMethod === 'bank_transfer'
          ? {
              bankName: (recipient.accountDetails as { bankName: string }).bankName,
              bankCode: (recipient.accountDetails as { bankCode: string }).bankCode,
              accountNumber: (recipient.accountDetails as { accountNumber: string }).accountNumber,
            }
          : {
              phone: (recipient.accountDetails as { phone: string }).phone,
              network: (recipient.accountDetails as { network: string }).network,
            }),
      }
    : { payoutMethod: 'bank_transfer' };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const payoutMethod = watch('payoutMethod');

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const accountDetails =
        values.payoutMethod === 'bank_transfer'
          ? { bankName: values.bankName!, bankCode: values.bankCode!, accountNumber: values.accountNumber! }
          : { phone: values.phone!, network: values.network! };

      if (isEdit) {
        await updateRecipient(recipient!.id, {
          nickname: values.nickname,
          firstName: values.firstName,
          lastName: values.lastName,
          accountDetails,
        });
      } else {
        await createRecipient({
          nickname: values.nickname,
          firstName: values.firstName,
          lastName: values.lastName,
          country: values.country,
          payoutMethod: values.payoutMethod,
          accountDetails,
        });
      }
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to save recipient');
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Edit recipient' : 'Add recipient'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {serverError && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            <input
              type="text"
              {...register('firstName')}
              className="input-base"
            />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <input type="text" {...register('lastName')} className="input-base" />
          </Field>
        </div>

        <Field label="Nickname" error={errors.nickname?.message}>
          <input type="text" {...register('nickname')} className="input-base" />
        </Field>

        {!isEdit && (
          <Field label="Country" error={errors.country?.message}>
            <select {...register('country')} className="input-base">
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isEdit && (
          <Field label="Payout method" error={errors.payoutMethod?.message}>
            <select {...register('payoutMethod')} className="input-base">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </Field>
        )}

        {payoutMethod === 'bank_transfer' && (
          <>
            <Field label="Bank name" error={errors.bankName?.message}>
              <input type="text" {...register('bankName')} className="input-base" />
            </Field>
            <Field label="Bank code" error={errors.bankCode?.message}>
              <input type="text" {...register('bankCode')} className="input-base" />
            </Field>
            <Field label="Account number" error={errors.accountNumber?.message}>
              <input type="text" {...register('accountNumber')} className="input-base" />
            </Field>
          </>
        )}

        {payoutMethod === 'mobile_money' && (
          <>
            <Field label="Phone number" error={errors.phone?.message}>
              <input type="tel" {...register('phone')} className="input-base" />
            </Field>
            <Field label="Network" error={errors.network?.message}>
              <input type="text" {...register('network')} className="input-base" placeholder="e.g. MTN, Vodafone" />
            </Field>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" label="Cancel" variant="secondary" onClick={onClose} />
          <Button type="submit" label={isEdit ? 'Save changes' : 'Add recipient'} isLoading={isSubmitting} />
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const fieldId = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      {React.cloneElement(children as React.ReactElement, {
        id: fieldId,
        className:
          'w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
      })}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
