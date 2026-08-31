/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identité MAbeautyplus, retravaillée pour un usage écran prolongé :
        // le bleu sert d'accent d'interface, le rose reste réservé aux
        // actions fortes et aux états à signaler.
        marine: {
          50: '#f2f7f9', 100: '#e3eef2', 200: '#c5dde5', 300: '#98c4d3',
          400: '#5ba3ba', 500: '#35aedc', 600: '#1f7fa3', 700: '#1b6684',
          800: '#1a556d', 900: '#19475c', 950: '#0d2c3a',
        },
        rose: {
          50: '#fdf2f9', 100: '#fce7f4', 200: '#fbcfe9', 300: '#f9a8d6',
          400: '#f472bb', 500: '#f42abe', 600: '#d10e9c', 700: '#ae0b80',
          800: '#900c69', 900: '#780f59', 950: '#4a0134',
        },
        ardoise: {
          50: '#f7f9fa', 100: '#eef2f4', 200: '#dde5e9', 300: '#c2d0d7',
          400: '#94a9b4', 500: '#6d8492', 600: '#556a77', 700: '#465662',
          800: '#3c4a53', 900: '#354048', 950: '#1e262c',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        carte: '0 1px 2px rgba(30,38,44,.05), 0 8px 24px -18px rgba(30,38,44,.35)',
      },
    },
  },
  plugins: [],
};
