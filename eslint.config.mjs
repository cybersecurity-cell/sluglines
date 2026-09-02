import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/**
 * Flat config, replacing `.eslintrc.json` — `next lint` (and the eslintrc
 * format it read) is gone as of Next 16; ESLint runs directly via the `lint`
 * script in `package.json`, and `eslint-config-next` now ships its config as
 * a flat-config array rather than a legacy `extends` string.
 */
export default [
  ...nextCoreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'AI/**', 'Docs/**', 'public/**'],
  },
  // D-10's boundary rule, live now that lib/ai/** exists (Docs/DECISIONS.md
  // D-65): lib/ai/** may be imported only by app/**/api/agent/** (the one route
  // that runs the agent) and lib/ai/** itself. Every other file in src/ is
  // scoped out via `ignores` below rather than in, so a new app/** directory
  // added later is covered by default instead of needing to opt in.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/ai/**', 'src/app/api/agent/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/ai', '@/lib/ai/*', '@/lib/ai/**'],
              message:
                'lib/ai/** may be imported only by app/**/api/agent/** and lib/ai/** itself (Docs/DECISIONS.md D-10, D-65).',
            },
          ],
        },
      ],
    },
  },
]
