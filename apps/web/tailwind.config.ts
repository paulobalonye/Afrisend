import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E6F4EC',
          100: '#C2E3CE',
          200: '#9DD1B0',
          300: '#74C090',
          400: '#4DAE72',
          500: '#1A6B3A',
          600: '#155932',
          700: '#10472A',
          800: '#0B3521',
          900: '#062318',
        },
        gold: {
          400: '#F5C842',
          500: '#E6B800',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
