/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#004b87', // BPK PENABUR Blue
          600: '#003c6c',
          700: '#002d51',
          800: '#00203a',
          900: '#001426',
          950: '#000b18',
        }
      }
    },
  },
  plugins: [],
}
