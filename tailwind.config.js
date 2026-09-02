/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
          Charte du diagnostic Empreinte, étendue à toute l'application.
          Le teal porte l'interface, le magenta reste réservé aux actions
          fortes et aux états à signaler. Les noms de teintes ne changent
          pas — « marine » désigne désormais le teal —, ce qui évite de
          réécrire quarante fichiers pour un changement de couleur.
        */
        marine: {
          50: '#F4FBFB', 100: '#EAF7F7', 200: '#D3EFEF', 300: '#A9E0E0',
          400: '#6FCDCD', 500: '#3BBFBF', 600: '#2AA5A5', 700: '#1F8484',
          800: '#166363', 900: '#0F4344', 950: '#0A2E2F',
        },
        rose: {
          50: '#FEF1F7', 100: '#FDE3EF', 200: '#FBC7DF', 300: '#F79BC6',
          400: '#F160A4', 500: '#E8318A', 600: '#CE1E73', 700: '#AB135D',
          800: '#8B124D', 900: '#741343', 950: '#470723',
        },
        /* Le gris n'est pas neutre : il tire vers le vert-de-gris du teal. */
        ardoise: {
          50: '#FAFDFD', 100: '#F4FBFB', 200: '#E6EFEF', 300: '#CAD6D6',
          400: '#9BABAB', 500: '#7C9091', 600: '#5E7273', 700: '#41595A',
          800: '#2A4142', 900: '#152B2C', 950: '#0B1819',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        carte: '0 1px 2px rgba(21,43,44,.04), 0 10px 30px -22px rgba(21,43,44,.32)',
      },
    },
  },
  plugins: [],
};
