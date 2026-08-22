// The public surface, verified against a live database with an anonymous client.
//
// Sibling to tests/live-rls.test.mjs and deliberately not part of it. That file
// creates auth users and writes rows, so it refuses the production ref outright.
// This one issues **reads only**, holds **only the anon key**, and is therefore
// safe against any target including production — which is the point: after
// issue #19 applied 0001-0007 to bwpguotjzczmieeepczf, the claims that matter
// are about what an unauthenticated visitor can and cannot do there, and those
// can only be checked there.
//
// The whole file is `select` and `rpc`. It never holds a service-role key, never
// signs a user in, and never writes. If a future change needs a write, it belongs
// in live-rls.test.mjs behind that file's guard, not here.
//
// Skips silently without credentials, so `npm run test` stays green on a checkout
// that has never been pointed at a database.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ENV_FILE = '.env.public.local'

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

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? env('SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !ANON_KEY) {
  console.log(
    'live-public-surface: SKIPPED — no public credentials.\n' +
      `  Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or populate ${ENV_FILE}.`
  )
  process.exit(0)
}

// Same host guard live-rls uses: pin the shape before a request is sent, so
// editing a local file cannot point this at an arbitrary host.
const url = new URL(SUPABASE_URL)
assert.equal(url.protocol, 'https:', `URL must be https, got ${url.protocol}`)
assert.match(url.hostname, /^[a-z0-9]{20}\.supabase\.co$/, `not a supabase.co project host: ${url.hostname}`)

// A service-role key here would defeat every assertion below, since it bypasses
// RLS. Refuse one rather than silently reporting that everything is permitted.
const role = JSON.parse(Buffer.from(ANON_KEY.split('.')[1] ?? '', 'base64url').toString('utf8') || '{}').role
assert.notEqual(role, 'service_role', 'this file must be given the anon key, never the service-role key')

const ref = url.hostname.split('.')[0]
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

// -----------------------------------------------------------------------------
// Positive — the two M1 aggregates answer for an anonymous caller
//
// This is what turns every `unavailable` surface `live`: the homepage corridor
// strip, /spots/[slug] and the dashboard board all read these two functions and
// nothing else (D-33).
// -----------------------------------------------------------------------------
const COUNT_COLUMNS = [
  'spot_slug',
  'corridor',
  'direction',
  'waiting_count',
  'driver_offer_count',
  'rider_request_count',
]

for (const fn of ['get_public_spot_counts', 'get_public_open_offer_counts']) {
  const { data, error } = await anon.rpc(fn)

  assert.equal(error, null, `anon rpc ${fn} must succeed, got ${error?.code} ${error?.message}`)
  assert.ok(Array.isArray(data) && data.length > 0, `${fn} returned no rows`)
  assert.deepEqual(Object.keys(data[0]).sort(), [...COUNT_COLUMNS].sort(), `${fn} column contract`)

  // Counts only. A member id, a poster id or a timestamp leaking out of these
  // is the §8 M1 privacy line, and it is the whole reason the SELECT list is
  // pinned rather than assumed.
  for (const row of data) {
    for (const key of Object.keys(row)) {
      assert.ok(COUNT_COLUMNS.includes(key), `${fn} leaked column ${key}`)
    }
  }
}

const { data: spotCounts } = await anon.rpc('get_public_spot_counts')
assert.ok(spotCounts.length >= 40, `expected the active directory, got ${spotCounts.length} rows`)

// -----------------------------------------------------------------------------
// Positive — the directory itself is NOT anonymously readable
//
// `locations` is reference data, but its read policy is `to authenticated`
// (0004). The public pages get their spot facts from the committed directory in
// src/lib/domain/locations.ts, not from an anonymous select, and the aggregate
// functions above run as owner. So this must be refused.
// -----------------------------------------------------------------------------
const locations = await anon.from('locations').select('slug').limit(1)
assert.ok(locations.error, 'anon select on locations must be refused')

// -----------------------------------------------------------------------------
// Negative — the four tables issue #19 names, each a database refusal
// -----------------------------------------------------------------------------
for (const table of ['offers', 'reservations', 'members', 'presence_checkins']) {
  const { data, error } = await anon.from(table).select('*').limit(1)

  assert.ok(error, `anon select on ${table} must be refused, got ${JSON.stringify(data)}`)
  // A refusal with no SQLSTATE is a transport failure, not a policy decision —
  // the D-29 lesson: an error is not by itself evidence that anything was enforced.
  assert.ok(error.code, `anon select on ${table} was refused without a SQLSTATE: ${error.message}`)
  assert.equal(error.code, '42501', `expected permission denied on ${table}, got ${error.code}`)
}

// A write is refused too, and for the same reason: no table has an insert policy
// for any role, and anon holds no grant.
const insert = await anon.from('presence_checkins').insert({ member_id: '00000000-0000-4000-8000-000000000000' })
assert.ok(insert.error, 'anon insert must be refused')

// The SECURITY DEFINER writers are not anonymously callable (R10): only the two
// aggregates above are granted to anon.
const write = await anon.rpc('presence_clear')
assert.ok(write.error, 'anon rpc presence_clear must be refused')

console.log(
  `live-public-surface: ok against ${ref} — both aggregates answer anon ` +
    `(${spotCounts.length} active spots); offers, reservations, members, presence_checkins, ` +
    'locations all refused 42501'
)
