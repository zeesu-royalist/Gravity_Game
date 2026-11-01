/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#040711',
          800: '#0a1026',
          700: '#111b3d',
          accent: '#00f0ff',
          neon: '#39ff14',
          alert: '#ff0055',
          gold: '#ffb703'
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { filter: 'drop-shadow(0 0 5px rgba(0,240,255,0.4))' },
          '100%': { filter: 'drop-shadow(0 0 20px rgba(0,240,255,0.9))' }
        }
      }
    },
  },
  plugins: [],
}

