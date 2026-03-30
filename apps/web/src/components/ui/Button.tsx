'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500 disabled:bg-brand-200',
  secondary:
    'border border-brand-500 text-brand-500 bg-white hover:bg-brand-50 focus:ring-brand-500 disabled:border-gray-300 disabled:text-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-200',
  ghost:
    'text-brand-500 hover:bg-brand-50 focus:ring-brand-500 disabled:text-gray-400',
};

export function Button({
  label,
  type = 'button',
  variant = 'primary',
  disabled = false,
  isLoading = false,
  fullWidth = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center justify-center rounded-xl px-6 py-3',
        'text-base font-semibold transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {isLoading && (
        <span
          data-testid="button-spinner"
          className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {label}
    </button>
  );
}
