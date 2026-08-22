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

// --- how it gets past Vercel Authentication (#47) ----------------------------
// The credential must never travel as a query parameter. This script's entire
// job is to observe what the edge does with an *unmodified* legacy path, and a
// `?secret=` appended to every request is a different URL than the one an old
// bookmark carries.
assert.match(code, /'x-vercel-protection-bypass'/, 'automation bypass is presented as a header')
assert.equal(
  /searchParams\.set\('x-vercel-protection-bypass'/.test(code),
  false,
  'the bypass secret must never be appended to the URL under test'
)

// CI supplies it as a secret rather than on the command line, where it would be
// captured in the run log.
assert.match(code, /VERCEL_AUTOMATION_BYPASS_SECRET/, 'the secret can come from the environment')

// The share token is exchanged for a cookie; the bypass header is not. Sending
// both would mean establishing a session that the header already made
// unnecessary, and would fail noisily when only the secret is set.
assert.match(code, /if \(bypassSecret\) return/, 'the header short-circuits share-token session setup')

const inventory = JSON.parse(fs.readFileSync(path.join(root, 'src/data/legacy-site-content.json'), 'utf8'))
assert.equal(inventory.routes.length, 165, 'the inventory is 165 routes')
assert.equal(inventory.totals.routes, 165, 'and its own total agrees')

console.log(`legacy route verifier: wired to the policy, covers all ${inventory.routes.length} routes`)
