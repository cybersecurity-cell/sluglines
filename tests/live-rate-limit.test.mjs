// Live test for rate_limit_hit() (issue #55, 0012_durable_rate_limit.sql).
// Same shape as live-rls.test.mjs: skips silently with no preview
// credentials, refuses to run against production, and proves a claim the
// static analyser cannot — that the function actually enforces a cap across
// calls, and that anon really is refused.
//
// PRECONDITION: 0012 must already be applied to the target branch (it ships
// as APPLIED: no — see supabase/migrations/README.md for what "applying" is
// and is not in scope for this session). Until then this file still runs and
// still skips cleanly wherever .env.preview.local is absent.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const PRODUCTION_REF = 'bwpguotjzczmieeepczf'
const ENV_FILE = '.env.preview.local'

function loadEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return out
}

const fileEnv = loadEnvFile(path.join(process.cwd(), ENV_FILE))
const env = (key) => process.env[key] ?? fileEnv[key]

const SUPABASE_URL = env('SUPABASE_URL')
const ANON_KEY = env('SUPABASE_ANON_KEY')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.log(
    `live-rate-limit: SKIPPED — no preview credentials.\n` +
      `  Populate ${ENV_FILE} with:\n` +
      `    supabase branches get <branch> --project-ref ${PRODUCTION_REF} -o env > ${ENV_FILE}`
  )
  process.exit(0)
}

const supabaseUrl = new URL(SUPABASE_URL)
assert.equal(supabaseUrl.protocol, 'https:', `SUPABASE_URL must be https, got ${supabaseUrl.protocol}`)
assert.match(
  supabaseUrl.hostname,
  /^[a-z0-9]{20}\.supabase\.co$/,
  `SUPABASE_URL must be a supabase.co project host, got ${supabaseUrl.hostname}`
)
const targetRef = supabaseUrl.hostname.split('.')[0]
assert.notEqual(targetRef, PRODUCTION_REF, `refusing to run live tests against production (${PRODUCTION_REF})`)

console.log(`live-rate-limit: target preview project ${targetRef}`)

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(SUPABASE_URL, SERVICE_KEY, clientOpts)
const anon = createClient(SUPABASE_URL, ANON_KEY, clientOpts)

const key = `live-rate-limit-test:${randomUUID()}`

try {
  // ---------------------------------------------------------------------------
  // service_role: a max-2 window admits two hits, then denies the third and
  // reports a positive retry-after inside the window.
  // ---------------------------------------------------------------------------
  const now = Date.now()
  const args = (offsetMs) => ({
    p_key: key,
    p_window_ms: 60_000,
    p_max: 2,
    p_now: new Date(now + offsetMs).toISOString(),
  })

  const first = await service.rpc('rate_limit_hit', args(0))
  assert.equal(first.error, null, `first hit failed: ${first.error?.message}`)
  assert.equal(first.data[0].allowed, true, 'first hit must be allowed')
  assert.equal(first.data[0].retry_after_ms, 0, 'an allowed hit reports zero retry-after')

  const second = await service.rpc('rate_limit_hit', args(1_000))
  assert.equal(second.error, null, `second hit failed: ${second.error?.message}`)
  assert.equal(second.data[0].allowed, true, 'second hit (at the cap) must still be allowed')

  const third = await service.rpc('rate_limit_hit', args(2_000))
  assert.equal(third.error, null, `third hit failed: ${third.error?.message}`)
  assert.equal(third.data[0].allowed, false, 'third hit must be denied — the window is at its cap')
  assert.ok(third.data[0].retry_after_ms > 0, 'a denied hit must report a positive retry-after')
  assert.ok(third.data[0].retry_after_ms <= 60_000, 'retry-after must not exceed the window length')

  console.log(`  ok  service_role: max=2 admits two hits, denies the third, retry_after_ms=${third.data[0].retry_after_ms}`)

  // ---------------------------------------------------------------------------
  // A fourth, independent bucket key is unaffected by the one above — windows
  // are per-key, not global.
  // ---------------------------------------------------------------------------
  const otherKeyHit = await service.rpc('rate_limit_hit', {
    p_key: `${key}:other`,
    p_window_ms: 60_000,
    p_max: 2,
    p_now: new Date(now + 2_000).toISOString(),
  })
  assert.equal(otherKeyHit.error, null)
  assert.equal(otherKeyHit.data[0].allowed, true, 'a distinct bucket key must have its own, unspent budget')
  console.log('  ok  service_role: a distinct bucket key is unaffected by another key being exhausted')

  // ---------------------------------------------------------------------------
  // anon must be refused outright — this function is not on ANON_CALLABLE_
  // FUNCTIONS and is granted to service_role only (0012's own header explains
  // why: a client that could call this directly could forge or exhaust
  // anyone's rate-limit bucket).
  // ---------------------------------------------------------------------------
  const anonAttempt = await anon.rpc('rate_limit_hit', args(3_000))
  assert.ok(anonAttempt.error, 'anon must be refused; the call unexpectedly succeeded')
  console.log(`  ok  anon refused: ${anonAttempt.error.code ?? 'no-code'}: ${anonAttempt.error.message}`)
} finally {
  // Cleanup: service_role bypasses RLS, so a direct delete is the correct way
  // to tidy up test data — this table has no client-reachable write path at
  // all, which is exactly what the anon assertion above just proved.
  await service.from('rate_limit_windows').delete().like('bucket_key', `${key}%`)
}

console.log('live-rate-limit: ok')
