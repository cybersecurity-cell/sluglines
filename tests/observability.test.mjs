// Issue #144 — the observability basics: `unavailable` outcomes are logged as
// one structured line with no PII; the in-memory rate limiter evicts; the two
// service-role factories throw the same typed error; the login page carries
// the §10 reassurance. What this file does not claim: retention, a privacy
// page, or a consent text for the AI route — D-93 lists those as still open.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { unavailableEvent, reportUnavailable } from '../src/lib/observability.ts'
import { createFixedWindowLimiter } from '../src/lib/api/rate-limit.ts'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

// --- the line: scope, reason, code, name — never the message, never a row -----------
assert.deepEqual(unavailableEvent('x.read', 'why'), { event: 'unavailable', scope: 'x.read', reason: 'why' })
assert.deepEqual(
  unavailableEvent('x.read', 'why', { code: '42501', message: 'phone +15555550100 in message', name: 'PostgrestError' }),
  { event: 'unavailable', scope: 'x.read', reason: 'why', code: '42501', name: 'PostgrestError' },
  'the SQLSTATE and the error name are logged; the message, which can echo request values, is not'
)
assert.deepEqual(unavailableEvent('x', 'why', { status: 503 }), { event: 'unavailable', scope: 'x', reason: 'why', code: '503' })
assert.deepEqual(unavailableEvent('x', 'why', 'boom'), { event: 'unavailable', scope: 'x', reason: 'why' })
assert.deepEqual(unavailableEvent('x', 'why', null), { event: 'unavailable', scope: 'x', reason: 'why' })
assert.equal(JSON.stringify(unavailableEvent('x', 'why', { message: 'secret' })).includes('secret'), false)

// reportUnavailable writes exactly that line through console.error and never throws.
{
  const lines = []
  const original = console.error
  console.error = (line) => lines.push(line)
  try {
    reportUnavailable('t.scope', 'the reason', { code: 'PGRST301' })
    reportUnavailable('t.scope', 'no error')
  } finally {
    console.error = original
  }
  assert.equal(lines.length, 2)
  assert.deepEqual(JSON.parse(lines[0]), { event: 'unavailable', scope: 't.scope', reason: 'the reason', code: 'PGRST301' })
  assert.deepEqual(JSON.parse(lines[1]), { event: 'unavailable', scope: 't.scope', reason: 'no error' })
}

// Every module that returns an `unavailable` state now reports it.
for (const [file, scopes] of [
  ['src/lib/corridor-board.ts', ['corridor-board.offers', 'corridor-board.client']],
  ['src/lib/dashboard.ts', ['dashboard.presence', 'dashboard.client']],
  ['src/lib/onboarding.ts', ['onboarding.profile', 'onboarding.home-spots']],
  ['src/lib/public-directory.ts', ['public-directory.location', 'public-directory.counts']],
]) {
  const source = read(file)
  assert.match(source, /import \{ reportUnavailable \} from '@\/lib\/observability\.ts'/, `${file} imports the reporter`)
  for (const scope of scopes) {
    assert.ok(source.includes(`reportUnavailable('${scope}'`), `${file} reports ${scope}`)
  }
}

// --- the rate limiter evicts keys whose window has passed, once per window --------
{
  const limiter = createFixedWindowLimiter({ max: 2, windowMs: 1000 })
  for (let i = 0; i < 50; i += 1) limiter.consume(`ip:${i}`, 0)
  assert.equal(limiter.size(), 50, 'fifty distinct keys are held inside the window')
  limiter.consume('ip:0', 500)
  assert.equal(limiter.size(), 50, 'nothing is evicted while the window is still open')
  limiter.consume('fresh', 1001)
  assert.equal(limiter.size(), 2, 'past the window every stale key is gone; ip:0 (hit again at 500) and the fresh key remain')
  // Eviction never loosens a limit: a key still inside its window keeps its
  // hits across a sweep. The last sweep ran at t=1001, so the next one runs on
  // the first consume at t>=2001.
  limiter.consume('k', 1900)
  limiter.consume('k', 1950)
  limiter.consume('other', 2001) // triggers a sweep; k's hits at 1900/1950 are inside (1001, 2001]
  assert.equal(limiter.consume('k', 2002).allowed, false, 'a sweep does not reset a key that is still inside its window')
}

// --- one typed error for a missing service-role key --------------------------------
const serviceRole = read('src/lib/supabase/service-role.ts')
assert.match(serviceRole, /import \{ ServiceRoleKeyMissingError \} from '\.\/service'/, 'the AI writer factory shares the typed error')
assert.match(serviceRole, /if \(!serviceRoleKey\) \{\s*throw new ServiceRoleKeyMissingError\(\)/, 'a missing key is a typed error, not a `!` and a confusing throw from supabase-js')
assert.equal(/SUPABASE_SERVICE_ROLE_KEY!/.test(serviceRole), false, 'no non-null assertion on the key')

// --- the §10 login reassurance ----------------------------------------------------
assert.match(read('src/app/login/page.tsx'), /Other sluggers never see your number/, 'the login page says what happens to the number')

console.log('observability: ok')
