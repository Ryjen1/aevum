/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: {
      none: '0',
      DEFAULT: '0',
    },
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a0a',
          surface: '#111111',
          border: '#222222',
          text: '#e0e0e0',
          muted: '#666666',
          dim: '#333333',
          green: '#00ff88',
          amber: '#ffaa00',
          red: '#ff4444',
          cyan: '#00aaff',
          magenta: '#ff00ff',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
        sans: ['"JetBrains Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 8px rgba(0, 255, 136, 0.4)',
        'glow-amber': '0 0 8px rgba(255, 170, 0, 0.4)',
        'glow-red': '0 0 8px rgba(255, 68, 68, 0.4)',
        'glow-cyan': '0 0 8px rgba(0, 170, 255, 0.4)',
      },
      animation: {
        'blink': 'blink 1s steps(1) infinite',
        'scan': 'scan 8s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'spin-frames': 'spin-frames 0.4s steps(4) infinite',
        'typewriter': 'typewriter 0.6s steps(20) forwards',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'spin-frames': {
          '0%': { content: '"|"' },
          '25%': { content: '"/"' },
          '50%': { content: '"-"' },
          '75%': { content: '"\\\\"' },
          '100%': { content: '"|"' },
        },
        typewriter: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
};
