// `/api/health` — structural assertions over the route the external uptime check
// watches (issue #21).
//
// This file cannot execute the handler: it needs `next/headers`, which only
// exists inside a request. What it can do is pin the properties that make the
// endpoint *useful as a monitor*, all of which are visible in the source and all
// of which a well-meaning refactor could silently remove.
//
// The one that matters most is the status code. An uptime check that only reads
// the status line has to be correct without parsing the body — an endpoint that
// always answers 200 and hides the failure in JSON turns an outage into a green
// dashboard, which is worse than having no endpoint at all.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const route = fs.readFileSync(path.join(root, 'src/app/api/health/route.ts'), 'utf8')
const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// --- it actually looks -------------------------------------------------------
assert.match(code, /\.rpc\(PUBLIC_SPOT_COUNTS_FUNCTION\)/, 'it queries the database rather than reporting ok blindly')
assert.match(code, /\.rpc\(PUBLIC_OPEN_OFFER_COUNTS_FUNCTION\)/, 'both aggregates the board needs are checked')
assert.match(code, /from '@\/lib\/domain\/public-counts'/, 'the function names come from the domain contract, not string literals')

// --- it fails loudly ---------------------------------------------------------
assert.match(code, /status: ok \? 200 : 503/, 'a failed check must be a 503, readable from the status line alone')
assert.match(code, /rows > 0/, 'an empty directory is an outage of the public surface, not a success')
assert.match(code, /cache-control/, 'a cached health check reports the past')
assert.match(code, /'no-store/, 'and no-store is how it stops doing that')
assert.match(code, /export const dynamic = 'force-dynamic'/, 'never prerendered')

// --- it says which build answered -------------------------------------------
assert.match(code, /VERCEL_GIT_COMMIT_SHA/, 'a green check must identify the deployment it came from')

// --- it never reports a fact it did not measure ------------------------------
assert.match(code, /scheduledJobs/, 'the sweeps are reported')
assert.match(code, /lastRunAt: null/, 'as null, because pg_cron is not installed and they have never run (#46)')
assert.match(code, /supported: false/)
assert.equal(
  /lastRunAt: new Date\(\)/.test(code),
  false,
  'a last-run timestamp must never be synthesised from the current time'
)

// --- it carries no member data ----------------------------------------------
for (const forbidden of ['members', 'presence_checkins', 'offers', 'reservations', 'phone', 'display_name']) {
  assert.equal(
    new RegExp(`from\\('${forbidden}'\\)`).test(code),
    false,
    `the health endpoint must not select from ${forbidden}`
  )
}

console.log('health endpoint: 503 on failure, no-store, deployment identified, no synthesised timestamps')
