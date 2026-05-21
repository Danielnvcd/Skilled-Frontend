/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f3f6fb',
          100: '#e4ecf6',
          200: '#c5d6e9',
          300: '#9ab6d6',
          400: '#688fbc',
          500: '#4471a3',
          600: '#345a89',
          700: '#2b4870',
          800: '#1f3554',
          900: '#152540',
          950: '#0c1830',
        },
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        elevated: '0 4px 16px -2px rgb(15 23 42 / 0.08), 0 2px 6px -1px rgb(15 23 42 / 0.04)',
        modal: '0 20px 50px -12px rgb(15 23 42 / 0.25)',
      },
      borderRadius: {
        xl: '0.75rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'scale-in': {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
