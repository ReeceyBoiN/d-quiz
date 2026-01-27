/** @type {import('tailwindcss').Config} */

// Import centralized breakpoints
import { BREAKPOINTS } from './src/utils/responsiveConfig.js';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Override Tailwind's default breakpoints with our centralized ones
    screens: {
      xs: `${BREAKPOINTS.xs}px`,
      sm: `${BREAKPOINTS.sm}px`,
      md: `${BREAKPOINTS.md}px`,
      lg: `${BREAKPOINTS.lg}px`,
      xl: `${BREAKPOINTS.xl}px`,
      '2xl': `${BREAKPOINTS['2xl']}px`,
    },
    extend: {
      // Fluid typography using CSS clamp()
      fontSize: {
        // Display/heading sizes
        'fluid-display': 'clamp(2rem, 8vw, 5rem)',  // 32px to 80px
        'fluid-h1': 'clamp(1.875rem, 6vw, 3.75rem)',  // 30px to 60px
        'fluid-h2': 'clamp(1.5rem, 4.5vw, 3rem)',    // 24px to 48px
        'fluid-h3': 'clamp(1.25rem, 3.5vw, 2.25rem)', // 20px to 36px
        'fluid-h4': 'clamp(1rem, 2.5vw, 1.75rem)',    // 16px to 28px
        // Body sizes
        'fluid-lg': 'clamp(1.125rem, 2.5vw, 1.5rem)',   // 18px to 24px
        'fluid-base': 'clamp(0.9rem, 2vw, 1.125rem)',   // 14.4px to 18px
        'fluid-sm': 'clamp(0.75rem, 1.5vw, 1rem)',      // 12px to 16px
        'fluid-xs': 'clamp(0.625rem, 1vw, 0.875rem)',   // 10px to 14px
      },
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
