import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dark neon palette tuned for high-contrast projection.
        bg: {
          900: '#06070d',
          800: '#0b0e18',
          700: '#121627',
          600: '#1a1f33',
        },
        neon: {
          green: '#22ff88',
          cyan: '#00e4ff',
          magenta: '#ff39c2',
          yellow: '#ffd93d',
          violet: '#9b6bff',
        },
        tile: {
          empty: '#1a1f33',
          border: '#2a3050',
          filled: '#2a3050',
          correct: '#22ff88',
          present: '#ffd93d',
          absent: '#3a3f55',
        },
      },
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(34, 255, 136, 0.35)',
        'neon-cyan': '0 0 20px rgba(0, 228, 255, 0.35)',
        'neon-magenta': '0 0 24px rgba(255, 57, 194, 0.4)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
