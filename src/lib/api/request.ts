import type { NextRequest } from 'next/server'

/**
 * A body that is not JSON is a malformed argument, which every caller of this
 * already reports as `invalid_argument`; returning `null` routes it there
 * rather than raising a second shape of the same error. Mirrors the private
 * `readJson` in `offer-transition-route.ts`, shared here because two routes
 * need it.
 */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/**
 * The caller's IP, best-effort, for the in-memory rate limiter. `NextRequest`
 * carries no reliable `ip` field once deployed off Vercel, so this reads the
 * proxy header a normal reverse proxy sets; `'unknown'` collapses every
 * caller with no header onto one bucket, which is a coarser limit rather than
 * a bypass.
 *
 * `x-vercel-forwarded-for` is checked first: Vercel's edge network sets it
 * itself, overwriting whatever a client sent, so it cannot be forged the way
 * `x-forwarded-for` can. Where that header is absent (e.g. local dev, or a
 * platform other than Vercel), this falls back to `x-forwarded-for` — but
 * reads the **rightmost** entry, not the leftmost. Each hop in a forwarding
 * chain *appends* its observed peer address; only the outermost trusted proxy
 * writes the rightmost entry, so that is the one hop this server actually
 * witnessed. Every entry to its left, including the leftmost, is whatever the
 * client claimed about itself and is trivially forged by sending
 * `X-Forwarded-For: <anything>` — which is exactly how every IP-keyed rate
 * limit here (OTP send/verify, CSP report) was bypassable before this fix.
 */
// Typed structurally rather than as `NextRequest`: this reads three headers
// and nothing else, and the narrower type forced a cast at the one call site
// that holds a plain `Request` (the CSP report collector). `NextRequest` still
// satisfies it, so no existing caller changes.
export function clientIp(request: { headers: Headers }): string {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwarded) return vercelForwarded.split(',')[0]!.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',')
    return hops[hops.length - 1]!.trim()
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}
