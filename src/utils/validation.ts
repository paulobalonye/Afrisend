import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(7, 'validation.invalidPhone')
  .max(20, 'validation.invalidPhone')
  .regex(/^\+?[0-9\s\-()]+$/, 'validation.invalidPhone');

export const otpSchema = z
  .string()
  .length(6, 'validation.invalidOtp')
  .regex(/^[0-9]+$/, 'validation.invalidOtp');

export const emailSchema = z
  .string()
  .min(1, 'validation.required')
  .email('validation.invalidEmail');

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordTooShort');

export const nameSchema = z
  .string()
  .min(2, 'validation.nameTooShort')
  .max(50, 'validation.nameTooShort');

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const profileSetupSchema = z.object({
  dateOfBirth: z.string().min(1, 'validation.required'),
  nationality: z.string().min(1, 'validation.required'),
  residenceCountry: z.string().min(1, 'validation.required'),
  purpose: z.enum(['family', 'business', 'savings', 'education', 'other']),
});

export type ProfileSetupFormData = z.infer<typeof profileSetupSchema>;

export const MAX_FILE_SIZE_MB = 10;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;

export function validateImageFile(uri: string, sizeBytes?: number): string | null {
  if (sizeBytes !== undefined && sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `errors.fileTooLarge`;
  }
  const ext = uri.toLowerCase().split('.').pop();
  if (ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') {
    return 'errors.unsupportedFormat';
  }
  return null;
}

export function formatPhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}
