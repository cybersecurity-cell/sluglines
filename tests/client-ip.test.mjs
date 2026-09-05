// Unit tests for `clientIp` (A10, issue-less finding from the phase A/B
// review): every IP-keyed rate limit (OTP send/verify, CSP report) buckets on
// this function's return value, so a forgeable result is a forgeable limit.

import { strict as assert } from 'node:assert'
import { clientIp } from '../src/lib/api/request.ts'

function reqWith(headers) {
  return { headers: new Headers(headers) }
}

// -----------------------------------------------------------------------------
// The bug this fixes: the leftmost `x-forwarded-for` entry is whatever the
// client itself claimed, and is trivially forged by sending an arbitrary
// header. Rotating it must not let a caller pick their own rate-limit bucket.
// -----------------------------------------------------------------------------
{
  const ip = clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))
  assert.notEqual(ip, '1.2.3.4', 'the leftmost (client-supplied) hop must not be trusted as the caller IP')
  assert.equal(ip, '5.6.7.8', 'falls back to the rightmost x-forwarded-for hop')
}

// -----------------------------------------------------------------------------
// `x-vercel-forwarded-for` is platform-set (Vercel's edge overwrites it, a
// client cannot), so it is trusted ahead of the forgeable header.
// -----------------------------------------------------------------------------
{
  const ip = clientIp(reqWith({ 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))
  assert.equal(ip, '9.9.9.9', 'x-vercel-forwarded-for must win over x-forwarded-for when both are present')
}

// A single-value x-vercel-forwarded-for is trimmed and returned as-is.
{
  const ip = clientIp(reqWith({ 'x-vercel-forwarded-for': '  9.9.9.9  ' }))
  assert.equal(ip, '9.9.9.9')
}

// A single-hop x-forwarded-for (no proxy chain) still resolves correctly:
// leftmost and rightmost are the same entry.
{
  const ip = clientIp(reqWith({ 'x-forwarded-for': '203.0.113.7' }))
  assert.equal(ip, '203.0.113.7')
}

// Whitespace around a hop is trimmed.
{
  const ip = clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4,   5.6.7.8   ' }))
  assert.equal(ip, '5.6.7.8')
}

// -----------------------------------------------------------------------------
// Fallback order below x-forwarded-for: x-real-ip, then 'unknown' — unchanged
// from before this fix, so a caller with no forwarding header at all still
// gets a bucket rather than an exception.
// -----------------------------------------------------------------------------
{
  const ip = clientIp(reqWith({ 'x-real-ip': '198.51.100.1' }))
  assert.equal(ip, '198.51.100.1')
}
{
  const ip = clientIp(reqWith({}))
  assert.equal(ip, 'unknown')
}

// -----------------------------------------------------------------------------
// A plain `Request`-shaped object (the CSP report collector's call site) works
// the same as a `NextRequest` — the structural type covers both.
// -----------------------------------------------------------------------------
{
  const request = new Request('https://example.test/api/csp-report', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
  })
  assert.equal(clientIp(request), '5.6.7.8')
}

console.log('client-ip: ok')
