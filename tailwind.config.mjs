/** @type {import('tailwindcss').Config} */
// Portfolio 2026 — Midnight Edition theme
// Tokens mirror docs/superpowers/specs/2026-04-10-portfolio-redesign-design.md §3
export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0C',
        'bg-2': '#111114',
        ink: '#E8E2D6',
        'ink-mid': 'rgba(232,226,214,0.65)',
        'ink-low': 'rgba(232,226,214,0.4)',
        rule: 'rgba(232,226,214,0.14)',
        accent: '#FF4A1F',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight2: '-0.011em',
        tight3: '-0.025em',
        tight4: '-0.035em',
        label: '0.14em',
        labelWide: '0.18em',
      },
      fontSize: {
        hero: ['clamp(60px, 9vw, 132px)', { lineHeight: '0.92' }],
        case: ['clamp(48px, 7vw, 84px)', { lineHeight: '1.02' }],
        feat: ['clamp(44px, 5.5vw, 72px)', { lineHeight: '1.02' }],
        folio: ['64px', { lineHeight: '1.05' }],
      },
      maxWidth: {
        lede: '540px',
        prose2: '720px',
      },
      animation: {
        'pulse-slow': 'pulseDot 2.4s ease-in-out infinite',
        reveal: 'reveal 600ms cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.88)' },
        },
        reveal: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
