/**
 * `lib/domain/auth-return.ts` — the pure half of "sign in, then go back to
 * where you were" (issue #136, D-86).
 *
 * THE RETURN PATH
 * ---------------------------------------------------------------------------
 * `/board` and the spot page send a signed-out visitor to `/login?next=...`.
 * That value is attacker-controllable (it is a URL parameter), so it is never
 * redirected to as-is: `safeNextPath` admits only a same-origin absolute path —
 * starts with one `/`, not `//` (a protocol-relative URL), no scheme, no
 * backslash, no control characters, bounded length — and returns `undefined`
 * for anything else, which every caller treats as "no `next`". An open
 * redirect through the sign-in flow is the classic phishing hop, and the check
 * is here, once, rather than re-derived in four files.
 *
 * THE ONBOARDING SKIP
 * ---------------------------------------------------------------------------
 * `handle_new_member()` (`0001`) creates every `members` row with the display
 * name `member-<first 8 hex of the id>`. `/onboarding` exists to replace that
 * placeholder; a member whose name is anything else has already been through
 * it, and sending them there on every sign-in (rev. 5.3 §10 (3) says once) is
 * the friction the issue names. `isPlaceholderDisplayName` is the test.
 *
 * THE OTP PHONE COOKIE
 * ---------------------------------------------------------------------------
 * The phone number used to travel from `/login` to `/verify` in the query
 * string — into browser history, referrers and every request log. It now rides
 * in a short-lived httpOnly cookie the send route sets and the verify route
 * clears. The name and lifetime live here so the two routes and the page agree.
 */

export const DEFAULT_SIGNED_IN_PATH = '/dashboard'

/** The longest `next` accepted. Long enough for any route here; short enough to bound abuse. */
export const NEXT_PATH_MAX_LENGTH = 200

const SAFE_PATH = /^\/(?![/\\])[\x21-\x7e]*$/

/**
 * A same-origin absolute path, or `undefined`. Never throws, never normalises
 * a bad value into a good one.
 */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (value.length === 0 || value.length > NEXT_PATH_MAX_LENGTH) return undefined
  if (!SAFE_PATH.test(value)) return undefined
  if (value.includes('\\')) return undefined
  return value
}

/** `path` with `?next=<next>` (or `&next=` when `path` already carries a query) when `next` is set. */
export function withNext(path: string, next: string | undefined): string {
  if (next === undefined) return path
  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`
}

/** The destination after sign-in: the safe `next`, else the dashboard. */
export function signedInDestination(next: unknown): string {
  return safeNextPath(next) ?? DEFAULT_SIGNED_IN_PATH
}

const PLACEHOLDER_DISPLAY_NAME = /^member-[0-9a-f]{8}$/

/** The name `handle_new_member()` (`0001`) gives a brand-new row, and nothing a person would choose. */
export function isPlaceholderDisplayName(displayName: unknown): boolean {
  return typeof displayName === 'string' && PLACEHOLDER_DISPLAY_NAME.test(displayName)
}

/** Set by `POST /api/auth/send-otp`, read by `/verify`, cleared by `POST /api/auth/verify-otp`. */
export const OTP_PHONE_COOKIE = 'sl_otp_phone'

/** Ten minutes: longer than Supabase Auth's OTP validity by default, short enough not to outlive the attempt. */
export const OTP_PHONE_COOKIE_MAX_AGE_SECONDS = 10 * 60

/** Supabase Auth's own resend cooldown (D-8), shown as a countdown so the second tap has something to read. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60
