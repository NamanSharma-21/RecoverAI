/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#fdfcfc',
        foreground: '#000000',
        card: '#f5f3f1',
        'card-foreground': '#000000',
        border: '#ebe8e4',
        eggshell: '#fdfcfc',
        taupe: '#f5f3f1',
        stone: '#ebe8e4',
        ink: '#000000',
        graphite: '#44403b',
        smoke: '#777169',
        ash: '#a59f97',
        violet: {
          DEFAULT: '#0447ff',
          accent: '#0447ff',
        },
        orange: {
          DEFAULT: '#ff4704',
          accent: '#ff4704',
        },
      },
      borderRadius: {
        '20': '20px',
      },
    },
  },
  plugins: [],
};
