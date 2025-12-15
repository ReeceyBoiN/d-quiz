/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'flash-green': 'flashGreen 0.5s ease-in-out infinite',
        'flash-red': 'flashRed 0.5s ease-in-out infinite',
      },
      keyframes: {
        flashGreen: {
          '0%, 100%': {
            backgroundColor: 'rgb(34, 197, 94)',
            boxShadow: '0 0 10px rgba(34, 197, 94, 0.6), 0 0 20px rgba(34, 197, 94, 0.8), 0 0 30px rgba(34, 197, 94, 0.6), inset 0 0 10px rgba(34, 197, 94, 0.3)',
            transform: 'scale(1)',
          },
          '50%': {
            backgroundColor: 'rgb(22, 163, 74)',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.9), 0 0 40px rgba(34, 197, 94, 1), 0 0 60px rgba(34, 197, 94, 0.8), inset 0 0 15px rgba(34, 197, 94, 0.5), 0 10px 30px -5px rgba(34, 197, 94, 0.8)',
            transform: 'scale(1.02)',
          },
        },
        flashRed: {
          '0%, 100%': {
            backgroundColor: 'rgb(239, 68, 68)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.3)',
            transform: 'scale(1)',
          },
          '50%': {
            backgroundColor: 'rgb(220, 38, 38)',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.9), 0 0 40px rgba(239, 68, 68, 1), 0 0 60px rgba(239, 68, 68, 0.8), inset 0 0 15px rgba(239, 68, 68, 0.5), 0 10px 30px -5px rgba(239, 68, 68, 0.8)',
            transform: 'scale(1.02)',
          },
        },
      },
    },
  },
  plugins: [],
};
