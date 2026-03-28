export const palette = {
  // Brand
  green50: '#E6F4EC',
  green100: '#C2E3CE',
  green200: '#9DD1B0',
  green300: '#74C090',
  green400: '#4DAE72',
  green500: '#1A6B3A',  // Primary brand green
  green600: '#155932',
  green700: '#10472A',
  green800: '#0B3521',
  green900: '#062318',

  // Gold accent
  gold400: '#F5C842',
  gold500: '#E6B800',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  black: '#000000',

  // Semantic
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  orange400: '#FB923C',
  orange500: '#F97316',
  yellow400: '#FACC15',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
} as const;

export type Colors = {
  primary: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  borderFocus: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  overlay: string;
  inputBackground: string;
  cardBackground: string;
  statusBar: 'light' | 'dark';
};

export const lightColors: Colors = {
  primary: palette.green500,
  primaryDark: palette.green700,
  accent: palette.gold500,
  background: palette.white,
  surface: palette.gray50,
  surfaceSecondary: palette.gray100,
  text: palette.gray900,
  textSecondary: palette.gray600,
  textDisabled: palette.gray400,
  border: palette.gray200,
  borderFocus: palette.green500,
  error: palette.red500,
  warning: palette.orange500,
  success: palette.green500,
  info: palette.blue500,
  overlay: 'rgba(0,0,0,0.5)',
  inputBackground: palette.white,
  cardBackground: palette.white,
  statusBar: 'dark',
};

export const darkColors: Colors = {
  primary: palette.green400,
  primaryDark: palette.green300,
  accent: palette.gold400,
  background: palette.gray900,
  surface: palette.gray800,
  surfaceSecondary: palette.gray700,
  text: palette.gray50,
  textSecondary: palette.gray400,
  textDisabled: palette.gray600,
  border: palette.gray700,
  borderFocus: palette.green400,
  error: palette.red400,
  warning: palette.orange400,
  success: palette.green400,
  info: palette.blue400,
  overlay: 'rgba(0,0,0,0.7)',
  inputBackground: palette.gray800,
  cardBackground: palette.gray800,
  statusBar: 'light',
};
