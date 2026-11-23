/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
          surface: 'var(--bg-surface)',
          tertiary: 'var(--bg-surface)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        'on-accent': 'var(--on-accent)',
        'input-bg': 'var(--bg-secondary)',
        scrim: 'var(--scrim)',
        danger: 'var(--error)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-secondary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          active: 'var(--border-active)',
        },
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        info: 'var(--info)',
      },
      borderRadius: {
        'card': '12px',
        'input': '8px',
        'button': '8px',
        'badge': '9999px',
      },
      // No decorative animations (spec 4.6, MOTION 1): only Tailwind's animate-spin for spinners.
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.15)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.25)',
        'toast': '0 4px 16px rgba(0,0,0,0.3)',
      }
    },
  },
  plugins: [],
}
