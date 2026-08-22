// The issue #23 verifier is a committed instrument, so the suite holds it to the
// one property that makes it trustworthy: it must derive every expectation from
// `classifyLegacyPath()` — the same function the middleware calls — rather than
// carrying a second copy of the redirect policy.
//
// A checker with its own copy of the map cannot fail: it drifts alongside the
// thing it is checking, and agrees with itself forever. That is the failure mode
// worth a test, and it is not one the checker's own output would ever reveal.
//
// The network run itself is not in CI. There is no publicly reachable URL to hit
// (#47), and a suite that silently skips when a deployment is unreachable is the
// same "gate that only looks green" this repo keeps refusing elsewhere. The
// script is run against a named origin and its output pasted into the record —
// D-44 for the pre-DNS run, and again after DNS per #23's second bullet.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const script = fs.readFileSync(path.join(root, 'scripts/verify-legacy-routes.mjs'), 'utf8')
const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// It uses the policy, and does not restate it.
assert.match(code, /from '\.\.\/src\/lib\/legacy-redirects\.ts'/, 'expectations come from the committed policy')
assert.match(code, /classifyLegacyPath\(pathname\)/, 'and from the same function the middleware calls')
assert.match(code, /MOVED_PERMANENTLY|GONE/, 'status constants are imported, not typed as literals')

// It checks the whole inventory, not a sample.
assert.match(code, /legacy-site-content\.json/, 'the route list is the committed inventory')
assert.match(code, /inventory\.routes\.map/, 'every route in it')
assert.match(code, /results\.length !== inventory\.totals\.routes/, 'and a short run is a failure, not a pass')

// It observes rather than chases: a 301 under test must be seen, not followed.
assert.match(code, /redirect: 'manual'/, 'redirects are never followed automatically')

// It cannot report success without looking.
assert.match(code, /process\.exitCode = 1/, 'a failure sets a non-zero exit code')

const inventory = JSON.parse(fs.readFileSync(path.join(root, 'src/data/legacy-site-content.json'), 'utf8'))
assert.equal(inventory.routes.length, 165, 'the inventory is 165 routes')
assert.equal(inventory.totals.routes, 165, 'and its own total agrees')

console.log(`legacy route verifier: wired to the policy, covers all ${inventory.routes.length} routes`)
