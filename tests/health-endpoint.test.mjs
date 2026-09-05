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
// This block used to assert the literals `supported: false` / `lastRunAt: null`,
// which were true while pg_cron was uninstalled (#46) and would have stayed in
// the source, unchallenged, after the sweeps started running. Both are now
// derived from a reader, so what is pinned is that the derivation happens.
assert.match(code, /scheduledJobs/, 'the sweeps are reported')
assert.match(code, /\.rpc\(SCHEDULED_JOB_HEALTH_FUNCTION\)/, 'sweep state is read from the database, not asserted')
assert.match(code, /summariseScheduledJobs/, 'and folded by the tested domain function')
assert.match(
  code,
  /from '@\/lib\/domain\/scheduled-jobs'/,
  'the reader name comes from the domain contract, not a string literal'
)
assert.equal(
  /lastRunAt: new Date\(\)/.test(code),
  false,
  'a last-run timestamp must never be synthesised from the current time'
)

// A stopped scheduler must not turn every pg_cron-less environment — preview
// branches, local runs — into a permanent 503. `scheduledJobs` is reported
// beside `checks`, never inside it, so it cannot reach the status line.
assert.equal(
  /checks\.scheduledJobs/.test(code),
  false,
  'sweep state must not be one of the checks that decide 200 vs 503'
)

// --- it carries no member data ----------------------------------------------
for (const forbidden of ['members', 'presence_checkins', 'offers', 'reservations', 'phone', 'display_name']) {
  assert.equal(
    new RegExp(`from\\('${forbidden}'\\)`).test(code),
    false,
    `the health endpoint must not select from ${forbidden}`
  )
}

// --- the rateLimiter check (#117): the service-role path is finally observed -
//
// This is the one check that constructs the service-role client rather than
// the anonymous one, and the one thing worth pinning is that it is a real
// `checks` entry — able to move the status line to 503 — not a side note like
// `scheduledJobs` above.
assert.match(code, /createServiceClient/, 'it exercises the service-role client, not just the anonymous one')
assert.match(code, /from '@\/lib\/supabase\/service'/, 'the service client comes from the shared module, not a local reimplementation')
assert.match(code, /checks\.rateLimiter\s*=/, 'the result is one of the checks that decide the status line')
assert.match(code, /\.rpc\('rate_limit_hit'/, 'it calls the same RPC durable-rate-limit.ts calls')
assert.match(code, /ServiceRoleKeyMissingError/, 'it distinguishes "key unset" from "key present but RPC failed"')
assert.match(code, /SUPABASE_SERVICE_ROLE_KEY is unset/, 'the key-absent path names the diagnostic issue #117 needs')

const rateLimiterSection = code.slice(code.indexOf('HEALTH_PROBE_BUCKET_KEY'), code.indexOf('let scheduledJobs'))
assert.ok(rateLimiterSection.length > 0, 'the rate limiter check block must exist between the offer check and the sweeps block')
assert.equal(
  /error\.message/.test(rateLimiterSection),
  false,
  'a service-role RPC or thrown error must never surface .message here — the public, unauthenticated response must carry no connection detail'
)
assert.match(rateLimiterSection, /error\.code/, 'an RPC error surfaces its sqlstate/code, never its message')
assert.match(rateLimiterSection, /error\.constructor\.name/, 'a thrown error surfaces its class, never its message')
assert.equal(
  /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(code),
  false,
  'the route must never touch the raw env var itself — only createServiceClient() does'
)

// --- the key-absent path is a catchable, diagnostic error, not a raw throw --
//
// `route.ts` cannot be executed here (it needs `next/headers`), but
// `createServiceClient()` has no such dependency, so its documented behaviour
// — the exact behaviour the health check's catch block depends on — is
// verified directly: a missing key is a typed, catchable error naming the
// variable, not an unhandled throw from deep inside `@supabase/supabase-js`.
{
  const { createServiceClient, ServiceRoleKeyMissingError } = await import('../src/lib/supabase/service.ts')
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    assert.throws(
      () => createServiceClient(),
      ServiceRoleKeyMissingError,
      'a missing SUPABASE_SERVICE_ROLE_KEY must throw this named, catchable error'
    )

    try {
      createServiceClient()
      assert.fail('createServiceClient() must throw when the key is unset')
    } catch (error) {
      assert.ok(error instanceof ServiceRoleKeyMissingError)
      assert.match(error.message, /SUPABASE_SERVICE_ROLE_KEY/, 'the diagnostic must name the unset variable')
      assert.doesNotMatch(error.message, /^SUPABASE_SERVICE_ROLE_KEY=.+/, 'the message names the variable, never a value')
    }
  } finally {
    if (original !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = original
  }
}

console.log('health endpoint: 503 on failure, no-store, deployment identified, no synthesised timestamps, service-role rate limiter observed')
