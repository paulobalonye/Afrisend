import {
  phoneSchema,
  otpSchema,
  emailSchema,
  passwordSchema,
  nameSchema,
  registerSchema,
  validateImageFile,
  formatPhone,
  MAX_FILE_SIZE_MB,
} from '../../src/utils/validation';

describe('phoneSchema', () => {
  it('accepts valid phone numbers', () => {
    expect(phoneSchema.safeParse('+1 555 123 4567').success).toBe(true);
    expect(phoneSchema.safeParse('+447911123456').success).toBe(true);
    expect(phoneSchema.safeParse('+2348012345678').success).toBe(true);
  });

  it('rejects phone numbers that are too short', () => {
    const result = phoneSchema.safeParse('123');
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    const result = phoneSchema.safeParse('+1 abc def');
    expect(result.success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts exactly 6 digits', () => {
    expect(otpSchema.safeParse('123456').success).toBe(true);
    expect(otpSchema.safeParse('000000').success).toBe(true);
  });

  it('rejects codes that are not 6 digits', () => {
    expect(otpSchema.safeParse('12345').success).toBe(false);
    expect(otpSchema.safeParse('1234567').success).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(otpSchema.safeParse('12345a').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user+tag@afrisend.co').success).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('notanemail').success).toBe(false);
    expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts passwords with 8+ characters', () => {
    expect(passwordSchema.safeParse('password1').success).toBe(true);
    expect(passwordSchema.safeParse('VerySecure123!').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
  });
});

describe('nameSchema', () => {
  it('accepts names with 2+ characters', () => {
    expect(nameSchema.safeParse('Jo').success).toBe(true);
    expect(nameSchema.safeParse('Jean-Pierre').success).toBe(true);
  });

  it('rejects single character names', () => {
    expect(nameSchema.safeParse('A').success).toBe(false);
  });

  it('rejects empty names', () => {
    expect(nameSchema.safeParse('').success).toBe(false);
  });
});

describe('registerSchema', () => {
  const validData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('confirmPassword');
    }
  });

  it('rejects invalid email in registration', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('validateImageFile', () => {
  it('returns null for valid JPEG files', () => {
    expect(validateImageFile('file:///some/path/photo.jpg')).toBeNull();
    expect(validateImageFile('file:///some/path/photo.jpeg')).toBeNull();
  });

  it('returns null for valid PNG files', () => {
    expect(validateImageFile('file:///some/path/photo.png')).toBeNull();
  });

  it('returns error for unsupported formats', () => {
    expect(validateImageFile('file:///some/path/document.pdf')).toBe('errors.unsupportedFormat');
    expect(validateImageFile('file:///some/path/image.gif')).toBe('errors.unsupportedFormat');
  });

  it('returns error when file exceeds size limit', () => {
    const oversizeBytes = (MAX_FILE_SIZE_MB + 1) * 1024 * 1024;
    expect(validateImageFile('file:///path/photo.jpg', oversizeBytes)).toBe('errors.fileTooLarge');
  });

  it('returns null when file size is within limit', () => {
    const okBytes = (MAX_FILE_SIZE_MB - 1) * 1024 * 1024;
    expect(validateImageFile('file:///path/photo.jpg', okBytes)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('removes spaces, dashes, and parentheses', () => {
    expect(formatPhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(formatPhone('07911 123456')).toBe('07911123456');
  });

  it('leaves clean phone numbers unchanged', () => {
    expect(formatPhone('+447911123456')).toBe('+447911123456');
  });
});
