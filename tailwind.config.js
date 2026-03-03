/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', '"DM Sans"', 'system-ui'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: { 0: '#060608', 1: '#0c0c10', 2: '#141418', 3: '#1c1c22', 4: '#26262e' },
        fg: { 0: '#f0f0f2', 1: '#c8c8ce', 2: '#8e8e9a', 3: '#5c5c68' },
        line: { DEFAULT: '#22222a', hover: '#32323c' },
        blue: { DEFAULT: '#2563eb', light: '#3b82f6', muted: 'rgba(37,99,235,0.10)' },
        green: { DEFAULT: '#16a34a', muted: 'rgba(22,163,74,0.10)' },
        amber: { DEFAULT: '#d97706', muted: 'rgba(217,119,6,0.10)' },
        red: { DEFAULT: '#dc2626', muted: 'rgba(220,38,38,0.10)' },
        purple: { DEFAULT: '#a855f7', muted: 'rgba(168,85,247,0.10)' },
        purple: { DEFAULT: '#7c3aed', muted: 'rgba(124,58,237,0.10)' },
      },
      animation: {
        'in': 'fadeSlideIn 0.45s ease-out both',
        'pulse-slow': 'pulse 2.5s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
