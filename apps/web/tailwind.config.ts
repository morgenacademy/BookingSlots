import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hoe: {
          bg: '#F7F4F2',
          fg: '#1B1B1B',
          muted: '#6B6B6B',
          accent: '#E0D8CE',
          accentSoft: '#F1ECE6',
          brown: '#7F716A',
          brownDk: '#5F544F',
          line: '#E5DED7',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
