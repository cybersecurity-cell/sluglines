// The rev. 5.3 §11 baseline `N`, machine-checked.
//
// `N` is not decorative: the phase gates are written as "no gate may reduce N",
// so a stale `N` makes every one of them compare against the wrong number in the
// permissive direction. It has now drifted twice — D-4 recorded 137 assertions
// for a working-tree file that never landed, D-25 corrected it to 99, and by
// 2026-08-20 the file count alone was off by more than 2x (issue #7).
//
// So the number stops living only in prose. The architecture document's header
// is the single source of truth, this file re-measures the repo, and the two
// must agree. Adding or deleting a test file, or adding assertions, fails here
// until the header is updated in the same change — which is the point.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const testDir = path.join(root, 'tests')
const ARCHITECTURE_DOC = 'Docs/consolidated-architecture.md'

// The instrument, stated so a later recount uses the same one D-25 used:
// source-level `assert(` / `assert.method(` call sites. It counts what is
// written, not what executes — a call inside a loop is one site, which is
// exactly why D-4's 137 could not be reproduced.
const ASSERT_CALL = /\bassert(?:\.[A-Za-z]+)?\s*\(/g

const files = fs
  .readdirSync(testDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()

const measured = files.reduce(
  (acc, name) => {
    const source = fs.readFileSync(path.join(testDir, name), 'utf8')
    return { files: acc.files + 1, assertions: acc.assertions + (source.match(ASSERT_CALL) ?? []).length }
  },
  { files: 0, assertions: 0 }
)

// -----------------------------------------------------------------------------
// The header is the record; this file is the enforcement
// -----------------------------------------------------------------------------
const doc = fs.readFileSync(path.join(root, ARCHITECTURE_DOC), 'utf8')
const header = /\*\*Baseline N:\*\*\s*(\d+)\s+test files\s*\/\s*([\d,]+)\s+assertion call sites/.exec(doc)

assert.ok(
  header,
  `${ARCHITECTURE_DOC} must carry a header line of the form ` +
    '"**Baseline N:** <n> test files / <n> assertion call sites"'
)

const recorded = { files: Number(header[1]), assertions: Number(header[2].replace(/,/g, '')) }

assert.equal(
  measured.files,
  recorded.files,
  `${ARCHITECTURE_DOC} records ${recorded.files} test files; the repo has ${measured.files}. ` +
    'Update the header in the change that moved it, and add a DECISIONS entry if N went down.'
)

assert.equal(
  measured.assertions,
  recorded.assertions,
  `${ARCHITECTURE_DOC} records ${recorded.assertions} assertion call sites; the repo has ` +
    `${measured.assertions}. Update the header in the change that moved it.`
)

// A floor as well as an equality, so a change that lowers both the repo and the
// header in one edit still has to be deliberate about it.
assert.ok(measured.files >= 28, `N must not fall below the 2026-08-22 baseline of 28 files`)
assert.ok(measured.assertions >= 872, `N must not fall below the 2026-08-22 baseline of 872 assertion call sites`)

// Every test file is reachable by the runner: scripts/run-tests.mjs globs exactly
// this pattern, so a file named .test.js or tests/foo/bar.test.mjs would count
// nowhere and run nowhere.
for (const name of files) {
  assert.match(name, /^[a-z0-9-]+\.test\.mjs$/, `${name}: test files are kebab-case *.test.mjs at the top of tests/`)
}

const nested = fs.readdirSync(testDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
assert.deepEqual(
  nested.map((entry) => entry.name),
  [],
  'tests/ is flat: scripts/run-tests.mjs does not recurse, so a nested file would never run'
)

console.log(`baseline N: ${measured.files} test files / ${measured.assertions} assertion call sites`)
