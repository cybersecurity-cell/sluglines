import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        hov: {
          green: '#16a34a',
          light: '#dcfce7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // The §10 redesign uses `font-mono` for every eyebrow, corridor label
        // and numeral. Without this line those utilities resolved to the
        // system monospace stack while the JetBrains Mono that
        // `src/app/layout.tsx` loads and preloads was referenced by nothing —
        // the font was being paid for and not used.
        //
        // The fallbacks are Tailwind's own default mono stack, kept explicitly
        // because `display: 'optional'` means a slow connection legitimately
        // renders the whole page in the fallback.
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
export default config
