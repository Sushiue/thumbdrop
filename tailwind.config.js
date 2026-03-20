/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        basic:          '#9ca3af',
        rare:           '#22c55e',
        super_rare:     '#3b82f6',
        epic:           '#a855f7',
        mythic:         '#f59e0b',
        legendary:      '#ef4444',
        ultra_legendary:'#ec4899',
        secret:         '#06b6d4',
        channel:        '#ffd700',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float':      'float 3s ease-in-out infinite',
        'spin-slow':  'spin 4s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%':      { boxShadow: '0 0 30px currentColor, 0 0 60px currentColor' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
