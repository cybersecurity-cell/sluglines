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
]
