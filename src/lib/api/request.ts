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
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
