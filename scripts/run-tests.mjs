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

// A suite that has no preview credentials prints "<name>: SKIPPED — ..." and
// exits 0 (see tests/live-*.test.mjs) rather than failing a checkout that has
// never been pointed at a database. That is a legitimate outcome, but it is
// not a pass: a skipped suite asserted nothing, and every live RLS assertion
// in the repo lives in these four suites. Counting it toward PASS is exactly
// how `npm test` went green while proving nothing about RLS (A6).
const SKIP_MARKER = /:\s*SKIPPED\b/
const requireNoSkips = process.env.REQUIRE_NO_SKIPS === '1'

const failed = []
const skipped = []

for (const name of files) {
  const started = Date.now()
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', path.join(testDir, name)],
    { cwd: root, stdio: ['inherit', 'pipe', 'pipe'] },
  )

  const elapsed = Date.now() - started
  const code = result.status
  const stdout = result.stdout?.toString() ?? ''
  const stderr = result.stderr?.toString() ?? ''
  process.stdout.write(stdout)
  process.stderr.write(stderr)

  if (result.error) {
    failed.push(`${name} (${result.error.message})`)
    console.error(`FAIL ${name} — ${result.error.message}`)
  } else if (result.signal) {
    failed.push(`${name} (killed by ${result.signal})`)
    console.error(`FAIL ${name} — killed by ${result.signal}`)
  } else if (code !== 0) {
    failed.push(`${name} (exit ${code})`)
    console.error(`FAIL ${name} — exit ${code}`)
  } else if (SKIP_MARKER.test(stdout)) {
    skipped.push(name)
    console.log(`skip ${name} (${elapsed} ms)`)
  } else {
    console.log(`ok   ${name} (${elapsed} ms)`)
  }
}

const passed = files.length - failed.length - skipped.length
console.log(`\nPASS=${passed} SKIP=${skipped.length} FAIL=${failed.length}`)

if (skipped.length > 0) {
  console.log(`\nSkipped files (no ok/fail verdict — see SKIPPED reason above):\n${skipped.map((entry) => `  - ${entry}`).join('\n')}`)
}

if (requireNoSkips && skipped.length > 0) {
  console.error(
    `\nREQUIRE_NO_SKIPS=1: ${skipped.length} suite(s) skipped instead of running. ` +
      'This run must execute for real, not skip.'
  )
  process.exit(1)
}

if (failed.length > 0) {
  console.error(`\nFailing files:\n${failed.map((entry) => `  - ${entry}`).join('\n')}`)
  process.exit(1)
}
