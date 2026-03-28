import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, lightColors, darkColors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export type Theme = {
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  isDark: boolean;
};

const buildTheme = (isDark: boolean): Theme => ({
  colors: isDark ? darkColors : lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  isDark,
});

export const lightTheme = buildTheme(false);
export const darkTheme = buildTheme(true);

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const theme = buildTheme(colorScheme === 'dark');

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export { Colors, lightColors, darkColors } from './colors';
export { typography } from './typography';
export { spacing, borderRadius, shadows } from './spacing';
