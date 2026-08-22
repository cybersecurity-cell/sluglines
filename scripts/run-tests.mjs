#!/usr/bin/env node

// Portable test runner. Replaces the PowerShell one-liner that `npm test` used to be,
// which could not execute on the ubuntu-latest runners every workflow uses (issue #5).
//
// Each tests/*.test.mjs file is a standalone script of node:assert calls, not a
// node:test suite, so each runs in its own process and its exit code is the verdict.
// The suite imports .ts modules directly, hence --experimental-strip-types.
//
// Node built-ins only, matching scripts/audit-check.mjs and scripts/sql-lint.mjs.

import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testDir = path.join(root, 'tests')

const pattern = process.argv[2]
const files = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .filter((name) => !pattern || name.includes(pattern))
  .sort()

if (files.length === 0) {
  console.error(pattern ? `No test files match "${pattern}".` : 'No test files found in tests/.')
  process.exit(1)
}

const failed = []

for (const name of files) {
  const started = Date.now()
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', path.join(testDir, name)],
    { cwd: root, stdio: 'inherit' },
  )

  const elapsed = Date.now() - started
  const code = result.status

  if (result.error) {
    failed.push(`${name} (${result.error.message})`)
    console.error(`FAIL ${name} — ${result.error.message}`)
  } else if (result.signal) {
    failed.push(`${name} (killed by ${result.signal})`)
    console.error(`FAIL ${name} — killed by ${result.signal}`)
  } else if (code !== 0) {
    failed.push(`${name} (exit ${code})`)
    console.error(`FAIL ${name} — exit ${code}`)
  } else {
    console.log(`ok   ${name} (${elapsed} ms)`)
  }
}

console.log(`\nPASS=${files.length - failed.length} FAIL=${failed.length}`)

if (failed.length > 0) {
  console.error(`\nFailing files:\n${failed.map((entry) => `  - ${entry}`).join('\n')}`)
  process.exit(1)
}
