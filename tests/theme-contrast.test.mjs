// Runs the issue #20 contrast gate inside the suite, so `npm run test` (and
// therefore CI) fails when a token edit drops a pair below WCAG AA. The script
// is the instrument and lives in scripts/ so it can also run standalone; this
// file makes it a gate rather than a tool someone has to remember.

import { strict as assert } from 'node:assert'
import { PAIRS, checkContrast, contrastRatio } from '../scripts/contrast-check.mjs'

// The instrument itself is testable: known ratios, computed not quoted.
assert.equal(contrastRatio('#000000', '#ffffff').toFixed(0), '21')
assert.equal(contrastRatio('#ffffff', '#000000').toFixed(0), '21', 'order must not matter')
assert.equal(contrastRatio('#777777', '#777777').toFixed(0), '1')
// The canonical AA boundary case: #767676 on white is just over 4.5:1.
assert.ok(contrastRatio('#767676', '#ffffff') > 4.5)
assert.ok(contrastRatio('#8a8a8a', '#ffffff') < 4.5, 'and a lighter grey fails, so the gate can fail')

// Both palettes are represented — the gate is "both themes", not one.
assert.ok(PAIRS.some((pair) => pair.theme === 'dark'), 'the dark shell is checked')
assert.ok(PAIRS.some((pair) => pair.theme === 'light'), 'the light public surface is checked')
assert.ok(PAIRS.length >= 20, `expected the full pair table, got ${PAIRS.length}`)

const { failures, report } = checkContrast()

assert.deepEqual(
  failures.map((pair) => `[${pair.theme}] ${pair.fg[0]} on ${pair.bg[0]}`),
  [],
  `pairs below WCAG AA:\n${report.filter((line) => line.startsWith('FAIL')).join('\n')}`
)

console.log(`theme contrast: ${PAIRS.length} pairs, both palettes, all AA`)
