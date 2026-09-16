// Issue #148 — a rider may withdraw only their own CONFIRMED seat before ARRIVING.
// Static contract coverage is deliberate: the live preview suite is credential-gated
// and is not configured in this worktree. These assertions keep the domain graph,
// effective SQL, grants, board wiring, and documentation in lockstep.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { OFFER_TRANSITION_OPERATIONS } from '../src/lib/domain/offer-transitions.ts'
import { canTransition } from '../src/lib/domain/offer-state.ts'

const root = process.cwd()
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')

const migration = read('supabase', 'migrations', '0031_confirmed_reservation_withdrawal.sql')
const migrationCode = migration.replace(/^--.*$/gm, '')
const domain = read('src', 'lib', 'domain', 'offer-state.ts')
const operations = read('src', 'lib', 'domain', 'offer-transitions.ts')
const actions = read('src', 'app', 'board', 'actions.ts')
const board = read('src', 'app', 'board', 'page.tsx')
const intent = read('Docs', 'intent', 'coordination-board.md')
const decisions = read('Docs', 'DECISIONS.md')

// A CONFIRMED rider may reopen only through RELEASED, never by inventing a
// direct CONFIRMED -> OPEN/PARTIALLY_RESERVED edge. ARRIVING remains the cutoff.
assert.equal(canTransition('CONFIRMED', 'RELEASED'), true)
assert.equal(canTransition('CONFIRMED', 'OPEN'), false)
assert.equal(canTransition('CONFIRMED', 'PARTIALLY_RESERVED'), false)
assert.equal(canTransition('ARRIVING', 'RELEASED'), false)
assert.match(domain, /CONFIRMED:\s*\['ARRIVING', 'CANCELLED', 'RELEASED'\]/)

const releaseOperation = OFFER_TRANSITION_OPERATIONS.find((operation) => operation.fn === 'offer_release_seat')
assert.ok(releaseOperation, 'the rider withdrawal must remain the member-owned release operation')
assert.equal(releaseOperation.actor, 'rider')
assert.equal(releaseOperation.clientCallable, true)
assert.deepEqual(
  releaseOperation.edges,
  [
    ['PARTIALLY_RESERVED', 'RELEASED'],
    ['RESERVED', 'RELEASED'],
    ['CONFIRMED', 'RELEASED'],
    ['RELEASED', 'OPEN'],
    ['RELEASED', 'PARTIALLY_RESERVED'],
  ]
)

// The append-only correction replaces, rather than overloads, the existing
// client writer. Actor identity comes from auth.uid(), not a supplied rider id.
assert.match(migration, /--\s*APPLIED:\s*no\b/)
assert.match(
  migration,
  /create or replace function public\.offer_release_seat\(\s*p_offer_id\s+uuid,\s*p_expected_revision\s+integer,\s*p_idempotency_key\s+text\s*\)/i
)
const withdrawalBody = /create or replace function public\.offer_release_seat[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(migration)?.[1]
assert.ok(withdrawalBody, '0031 must define the effective offer_release_seat body')
assert.match(withdrawalBody, /v_actor\s+uuid\s*:=\s*auth\.uid\(\)/i)
assert.equal(/p_(?:actor|rider|member|user)_id\s+uuid/i.test(migration), false, 'the caller must not name the rider')
assert.match(withdrawalBody, /and rider_id = v_actor\s+and state in \('ACTIVE', 'CONFIRMED'\)/i)
assert.match(withdrawalBody, /v_reservation_state = 'CONFIRMED' and v_state <> 'CONFIRMED'/i)
assert.match(withdrawalBody, /set state\s*=\s*case when v_reservation_state = 'CONFIRMED' then 'CANCELLED'/i)
assert.match(withdrawalBody, /apply_offer_transition\(\s*p_offer_id, 'RELEASED'/i)
assert.match(withdrawalBody, /case when v_remaining = 0 then 'OPEN' else 'PARTIALLY_RESERVED' end/i)
assert.match(withdrawalBody, /claim_offer_operation\(/i)
assert.match(withdrawalBody, /complete_offer_operation\(/i)
assert.equal(/promote_from_waitlist\(/i.test(withdrawalBody), false, 'withdrawal must not automatically promote a waiting rider')
assert.equal(/promote_waitlist_sweep\(/i.test(migrationCode), false, '0031 must not schedule or wire the global sweep')
assert.match(migration, /revoke all on function public\.offer_release_seat\(uuid, integer, text\) from public;/i)
assert.match(migration, /revoke all on function public\.offer_release_seat\(uuid, integer, text\) from anon;/i)
assert.match(migration, /grant execute on function public\.offer_release_seat\(uuid, integer, text\) to authenticated;/i)

// Manual promotion is a distinct poster-only client entry point. It delegates to
// the existing FIFO primitive, so it cannot select a later waiting rider or write
// offers/reservations directly.
assert.match(
  migration,
  /create or replace function public\.offer_promote_waitlist\(\s*p_offer_id\s+uuid,\s*p_expected_revision\s+integer,\s*p_idempotency_key\s+text\s*\)/i
)
const manualPromotionBody = /create or replace function public\.offer_promote_waitlist[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/i.exec(migration)?.[1]
assert.ok(manualPromotionBody, '0031 must define the poster-triggered FIFO promotion function')
assert.match(manualPromotionBody, /v_actor\s+uuid\s*:=\s*auth\.uid\(\)/i)
assert.match(manualPromotionBody, /v_offer\.poster_id <> v_actor/i)
assert.match(manualPromotionBody, /p_expected_revision is null or p_expected_revision <> v_offer\.revision/i)
assert.match(manualPromotionBody, /claim_offer_operation\(/i)
assert.match(manualPromotionBody, /promote_from_waitlist\(p_offer_id\)/i)
assert.match(manualPromotionBody, /complete_offer_operation\(/i)
assert.equal(/insert\s+into\s+public\.reservations/i.test(manualPromotionBody), false)
assert.equal(/update\s+public\.offers\s+set\s+state/i.test(manualPromotionBody), false)
assert.match(migration, /revoke all on function public\.offer_promote_waitlist\(uuid, integer, text\) from public;/i)
assert.match(migration, /revoke all on function public\.offer_promote_waitlist\(uuid, integer, text\) from anon;/i)
assert.match(migration, /grant execute on function public\.offer_promote_waitlist\(uuid, integer, text\) to authenticated;/i)

// The board exposes both actions only through server actions: no client table
// writer is introduced, and the completed rider's participant-only access ends
// because their reservation becomes CANCELLED.
assert.match(actions, /'offer_release_seat'/)
assert.match(actions, /'offer_promote_waitlist'/)
assert.equal(/\.update\(|\.delete\(|\.insert\(/.test(actions), false)
assert.match(board, /offer\.mySeat\?\.state === 'CONFIRMED' \?/) 
assert.match(board, /Withdraw confirmed seat/)
assert.match(board, /action=\{promoteWaitlist\}/)
assert.match(board, /Offer next waiting rider/)

assert.match(intent, /withdraws their own CONFIRMED seat before ARRIVING/i)
assert.match(intent, /manual FIFO promotion/i)
assert.match(decisions, /## D-96 —/)

console.log('confirmed-withdrawal: ok')
