/**
 * HTTP translation for the M2 OTP routes — the `send-otp`/`verify-otp` analogue
 * of `transition-http.ts`.
 *
 * Deliberately pure: no `next/server`, no Supabase client. Messages are
 * authored here, not forwarded from Supabase Auth — the same D-30 discipline
 * `transition-http.ts` documents, for the same reason: raw provider text is
 * written for an operator, and rev. 5.3 §8 M2's anti-enumeration requirement
 * (threat T10) means every refusal on this surface must read the same
 * regardless of *why* the database or the auth provider said no.
 */

export const OTP_ERROR_KINDS = ['invalid_argument', 'invalid_code', 'rate_limited', 'unavailable'] as const

export type OtpErrorKind = (typeof OTP_ERROR_KINDS)[number]

const MESSAGE_BY_KIND: Readonly<Record<OtpErrorKind, string>> = {
  invalid_argument: 'Enter a valid phone number.',
  invalid_code: 'That code is incorrect or has expired.',
  rate_limited: 'Too many attempts. Try again in a few minutes.',
  // A7: a config fault ("Something went wrong. Try again.") invited exactly
  // the immediate-retry loop that made #52's production 500 worse than it
  // needed to be. This says plainly the fault is ours and gives no "try again"
  // call to action — retrying now cannot fix a server-side misconfiguration.
  unavailable: "Sign-in isn't working on our end right now. Please check back later.",
}

const STATUS_BY_KIND: Readonly<Record<OtpErrorKind, number>> = {
  invalid_argument: 400,
  invalid_code: 400,
  rate_limited: 429,
  // 503, not 502: this kind now also covers GoTrue reporting the phone
  // provider itself disabled (see `PROVIDER_DISABLED_CODES` below), which is
  // "the service is not available" rather than "the upstream answered badly".
  unavailable: 503,
}

export interface OtpErrorBody {
  readonly error: {
    readonly kind: OtpErrorKind
    readonly message: string
  }
}

export function otpError(kind: OtpErrorKind): OtpErrorBody {
  return { error: { kind, message: MESSAGE_BY_KIND[kind] } }
}

export function otpStatus(kind: OtpErrorKind): number {
  return STATUS_BY_KIND[kind]
}

/**
 * GoTrue `error_code` values (surfaced by `supabase-js` as `AuthApiError.code`)
 * that mean "this feature is switched off", not "you gave a bad phone
 * number". Evidenced on the live project (Docs/2026-08-22-supabase-auth-
 * config.md, D-51): with `external_phone_enabled: false`, `POST /auth/v1/otp`
 * answers `400 phone_provider_disabled` — a 4xx that would otherwise
 * misclassify as `invalid_argument` and tell a visitor with a perfectly valid
 * number to fix it. Named explicitly rather than guessed at; add to this list
 * only against evidence of another such code, the same discipline `D-51`
 * itself follows.
 */
const PROVIDER_DISABLED_CODES = new Set(['phone_provider_disabled'])

interface ClassifiableAuthError {
  readonly status?: number
  readonly code?: string
}

/**
 * Classify a `supabase-js` `AuthError` into an `OtpErrorKind`.
 *
 * `status` is the HTTP status the GoTrue server answered with — 429 for its
 * own rate limits (resend cooldown, per-number/IP caps, D-8's PENDING config),
 * 4xx for a malformed or disallowed number, anything else reported as
 * `unavailable` rather than guessed. `invalid_code` is never produced here —
 * only `verifyOtp` failures classify to it, via `classifyVerifyError` below,
 * because a bad code and a bad phone number are different refusals to the
 * caller even though both start as a 4xx from the same provider.
 *
 * `code` is checked before `status`: a `phone_provider_disabled` 400 is not a
 * malformed argument, it is `unavailable` (A7) — this is the reactive
 * fallback for the same fact `phone-auth-availability.ts` checks proactively
 * before the form ever renders; this branch only fires if that check said
 * "enabled" (a stale cache, most plausibly) and the live call disagreed.
 */
export function classifySendError(error: ClassifiableAuthError | null | undefined): OtpErrorKind {
  if (typeof error?.code === 'string' && PROVIDER_DISABLED_CODES.has(error.code)) return 'unavailable'
  if (error?.status === 429) return 'rate_limited'
  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) return 'invalid_argument'
  return 'unavailable'
}

/**
 * Same shape, different 4xx meaning: `verifyOtp` answers 4xx for a wrong or
 * expired code, not a malformed request (the request was already validated
 * before the call). 401/403 in particular is GoTrue's "token invalid" case.
 */
export function classifyVerifyError(error: ClassifiableAuthError | null | undefined): OtpErrorKind {
  if (typeof error?.code === 'string' && PROVIDER_DISABLED_CODES.has(error.code)) return 'unavailable'
  if (error?.status === 429) return 'rate_limited'
  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) return 'invalid_code'
  return 'unavailable'
}
