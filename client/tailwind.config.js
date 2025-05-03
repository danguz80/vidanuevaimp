/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /animate-(fade-(left|right|up|down))/,
    },
  ],
  theme: {
    extend: {
      keyframes: {
        fadeRight: {
          '0%': { opacity: 0, transform: 'translateX(50px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        fadeLeft: {
          '0%': { opacity: 0, transform: 'translateX(-50px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(30px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%': { opacity: 0, transform: 'translateY(-30px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      animation: {
        'fade-right': 'fadeRight 1s ease-out forwards',
        'fade-left': 'fadeLeft 1s ease-out forwards',
        'fade-up': 'fadeUp 1s ease-out forwards',
        'fade-down': 'fadeDown 1s ease-out forwards',
        'fade-in': 'fadeIn 1s ease-out forwards',
      },
    },
  },
  plugins: [],
};
