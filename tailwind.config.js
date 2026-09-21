/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
          La direction artistique MAbeautyplus (skill « mabeautyplus-da »,
          septembre 2026), née de la charte du diagnostic BioPortrait. Le
          teal porte l'interface, le magenta reste réservé aux actions
          fortes et aux états à signaler. Les noms de teintes ne changent
          pas — « marine » désigne le teal —, ce qui évite de réécrire
          quarante fichiers pour un changement de couleur.

          Les crans qui comptent sont calés au code près sur les jetons de
          la DA : 50 = wash, 100 = wash-2, 300 = filet-aqua, 500 = aqua
          (aplats, pastilles, gros corps), 600 = aqua-profond (le bouton
          principal, écart assumé), 700 = aqua-texte — LE SEUL TEAL QUI
          ÉCRIT EN PETIT (4,8:1) —, 900 = aqua-encre. Rose 500 = rose,
          600 = rose-texte.
        */
        marine: {
          50: '#F4FBFB', 100: '#EAF7F7', 200: '#D3EFEF', 300: '#A8DEDE',
          400: '#7FD4D4', 500: '#3BBFBF', 600: '#2AA5A5', 700: '#1F7F7F',
          800: '#166363', 900: '#0F4344', 950: '#0A2E2F',
        },
        rose: {
          50: '#FEF3F8', 100: '#FDE3EF', 200: '#F6D3E4', 300: '#F79BC6',
          400: '#F160A4', 500: '#E8318A', 600: '#C42872', 700: '#AB135D',
          800: '#8B124D', 900: '#741343', 950: '#470723',
        },
        /* Le violet de la DA, troisième couleur du dégradé de marque et des graphiques. */
        violet: {
          50: '#F2EEFA', 200: '#CFC0E8', 500: '#8E6FC6', 600: '#7A5CB5',
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
      /*
        Les rayons de la DA : 8 étiquette, 12 visuel, 14 champ, 18 carte,
        22 encadré. Redéfinis sur les crans Tailwind pour que « rounded-2xl »
        fasse partout la carte de la charte, sans retoucher un seul écran.
      */
      borderRadius: {
        md: '8px', lg: '12px', xl: '14px', '2xl': '18px', '3xl': '22px',
      },
      /*
        « Des filets, pas des ombres » : une carte se délimite d'un trait.
        Les ombres de la DA sont réservées à ce qui se détache vraiment —
        une fenêtre, un encart qui flotte, le bouton qui engage.
      */
      boxShadow: {
        carte: '0 6px 16px -10px rgba(21,43,44,.28)',
        flottante: '0 16px 36px -24px rgba(21,43,44,.5)',
        cta: '0 10px 26px -10px rgba(232,49,138,.5)',
      },
    },
  },
  plugins: [],
};
