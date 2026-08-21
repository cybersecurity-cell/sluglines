// Module boundary enforcement for src/lib/domain/** — rev. 5.3 §8 dependency rule.
//
//   lib/domain/**  --imports-->  lib/supabase only (never React, never lib/ai)
//
// Docs/DECISIONS.md D-10 deferred the boundary rule because its subject did not
// exist: with no `lib/ai` in the repo, a `no-restricted-imports` rule could not
// be made to fail, and "a gate that only looks green" was rejected. `lib/domain`
// now exists, so its half of the rule is enforceable today — this test is that
// enforcement. The `lib/ai` half stays deferred until `lib/ai` exists.
//
// This is a static test rather than an ESLint rule on purpose: it fails in
// `npm run test`, which is the gate rev. 5.3 §12 constraint 7 actually requires
// output from. The ESLint rule lands with the P1 restructure.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const domainDir = path.join(root, 'src/lib/domain')

assert.equal(fs.existsSync(domainDir), true, 'src/lib/domain must exist')

function collect(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collect(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

const files = collect(domainDir)
assert.ok(files.length >= 2, 'expected at least the barrel and one domain module')

// `import ... from 'x'`, `export ... from 'x'`, and dynamic `import('x')`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g

const ALLOWED_ABSOLUTE = ['@/lib/supabase', 'node:']

// Escapes every regex metacharacter, backslash included. The previous inline
// .replace(/[/@]/g, ...) covered two characters that are not metacharacters and
// missed the ones that are.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/')
  const source = fs.readFileSync(file, 'utf8')

  // No React in the domain layer: it is called from server code and SQL-facing
  // services, and a React import is the first step to putting rendering
  // concerns behind a domain function.
  assert.equal(/\.tsx$/.test(file), false, `${rel}: lib/domain must not contain .tsx files`)
  assert.equal(/^['"]use client['"]/m.test(source), false, `${rel}: lib/domain must not be a client module`)

  for (const match of source.matchAll(SPECIFIER)) {
    const spec = match[1]

    if (spec.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), spec)
      assert.equal(
        resolved.startsWith(domainDir),
        true,
        `${rel}: relative import "${spec}" escapes lib/domain`
      )
      continue
    }

    assert.equal(
      ALLOWED_ABSOLUTE.some((prefix) => spec === prefix || spec.startsWith(`${prefix}/`) || spec.startsWith(prefix)),
      true,
      `${rel}: import "${spec}" is outside the lib/domain allowlist (${ALLOWED_ABSOLUTE.join(', ')})`
    )
  }

  // Named explicitly so the failure message says which rule broke, rather than
  // only "not on the allowlist".
  for (const forbidden of ['react', 'react-dom', 'next', 'lib/ai', '@/lib/ai', 'lucide-react']) {
    assert.equal(
      new RegExp(`(?:from|import\\()\\s*['"]${escapeRegExp(forbidden)}(?:/[^'"]*)?['"]`).test(source),
      false,
      `${rel}: lib/domain must never import "${forbidden}" (rev. 5.3 §8 dependency rule)`
    )
  }
}

// The rule as documented, so the allowlist cannot drift away from the docs
// without one of these failing.
const barrel = fs.readFileSync(path.join(domainDir, 'index.ts'), 'utf8')
assert.match(barrel, /never React, never lib\/ai/)

// The other half of D-10: lib/ai still does not exist, so the rule that forbids
// importing it has no subject. If this ever fails, the ESLint boundary rule is
// due in the same change.
assert.equal(
  fs.existsSync(path.join(root, 'src/lib/ai')),
  false,
  'src/lib/ai now exists: complete the ESLint boundary rule per Docs/DECISIONS.md D-10'
)
