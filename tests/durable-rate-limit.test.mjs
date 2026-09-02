// Unit tests for the durable, cross-instance rate limiter (issue #55). No live
// database: `RateLimitRpcClient` is a one-method structural interface, so a
// plain object stands in for a Supabase client here — the SQL side
// (`rate_limit_hit()`'s window/atomicity behaviour) is proven statically by
// `sql-migration-harness.test.mjs` and, where live credentials exist, by
// `live-rate-limit.test.mjs`.

import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { createDurableRateLimiter } from '../src/lib/api/durable-rate-limit.ts'

function fakeClient(handler) {
  const calls = []
  return {
    calls,
    async rpc(fn, args) {
      calls.push({ fn, args })
      return handler(fn, args)
    },
  }
}

const NOW = Date.parse('2026-09-02T12:00:00.000Z')

// -----------------------------------------------------------------------------
// The bucket key is hashed before it ever reaches the RPC call — this table
// must never carry a raw phone number or IP address (0012's own header).
// -----------------------------------------------------------------------------
{
  const client = fakeClient(() => ({ data: [{ allowed: true, retry_after_ms: 0 }], error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })

  await limiter.consume(client, 'phone:+15551234567', NOW)

  assert.equal(client.calls.length, 1)
  const { fn, args } = client.calls[0]
  assert.equal(fn, 'rate_limit_hit')
  assert.notEqual(args.p_key, 'phone:+15551234567', 'the raw key must never be sent as p_key')
  assert.match(args.p_key, /^[0-9a-f]{64}$/, 'p_key must be a sha256 hex digest')
  assert.equal(
    args.p_key,
    createHash('sha256').update('phone:+15551234567').digest('hex'),
    'the digest must be deterministic sha256 of the raw key'
  )
}

// -----------------------------------------------------------------------------
// Window and cap are forwarded verbatim; `now` is converted to an ISO
// timestamp the SQL function's `timestamptz` parameter can parse, never read
// from a real clock inside the adapter.
// -----------------------------------------------------------------------------
{
  const client = fakeClient(() => ({ data: [{ allowed: true, retry_after_ms: 0 }], error: null }))
  const limiter = createDurableRateLimiter({ max: 10, windowMs: 86_400_000 })

  await limiter.consume(client, 'ip:203.0.113.7', NOW)

  const { args } = client.calls[0]
  assert.equal(args.p_window_ms, 86_400_000)
  assert.equal(args.p_max, 10)
  assert.equal(args.p_now, new Date(NOW).toISOString())
}

// -----------------------------------------------------------------------------
// A different raw key hashes to a different bucket — two callers never
// collide onto the same counter.
// -----------------------------------------------------------------------------
{
  const client = fakeClient(() => ({ data: [{ allowed: true, retry_after_ms: 0 }], error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })

  await limiter.consume(client, 'phone:+15551234567', NOW)
  await limiter.consume(client, 'phone:+15559876543', NOW)

  assert.notEqual(client.calls[0].args.p_key, client.calls[1].args.p_key)
}

// -----------------------------------------------------------------------------
// Allowed / denied pass through the RPC row verbatim, same shape as
// `RateLimitResult` from rate-limit.ts.
// -----------------------------------------------------------------------------
{
  const client = fakeClient(() => ({ data: [{ allowed: true, retry_after_ms: 0 }], error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })
  const result = await limiter.consume(client, 'k', NOW)
  assert.deepEqual(result, { allowed: true, retryAfterMs: 0 })
}
{
  const client = fakeClient(() => ({ data: [{ allowed: false, retry_after_ms: 42_000 }], error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })
  const result = await limiter.consume(client, 'k', NOW)
  assert.deepEqual(result, { allowed: false, retryAfterMs: 42_000 })
}

// -----------------------------------------------------------------------------
// Fail OPEN on a database error or an empty/missing row, deliberately: D-45
// records that Supabase Auth's own per-number/IP controls are the real
// security boundary for these routes, and a transient outage here should
// degrade to "no extra limiting this request", not "OTP is unavailable".
// -----------------------------------------------------------------------------
{
  const client = fakeClient(() => ({ data: null, error: { message: 'connection reset' } }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })
  const result = await limiter.consume(client, 'k', NOW)
  assert.deepEqual(result, { allowed: true, retryAfterMs: 0 }, 'a database error must fail open')
}
{
  const client = fakeClient(() => ({ data: [], error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })
  const result = await limiter.consume(client, 'k', NOW)
  assert.deepEqual(result, { allowed: true, retryAfterMs: 0 }, 'an empty row set must fail open')
}
{
  const client = fakeClient(() => ({ data: null, error: null }))
  const limiter = createDurableRateLimiter({ max: 5, windowMs: 1000 })
  const result = await limiter.consume(client, 'k', NOW)
  assert.deepEqual(result, { allowed: true, retryAfterMs: 0 }, 'a null row set must fail open')
}

console.log('durable-rate-limit: ok')
