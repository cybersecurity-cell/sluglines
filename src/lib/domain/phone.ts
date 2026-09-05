/**
 * Phone and OTP-code shape validation for rev. 5.3 §8 M2 identity.
 *
 * Pure and IO-free, so it belongs in `lib/domain` under the §8 boundary rule
 * (`lib/domain/**` imports `lib/supabase` only, never React, never `lib/ai`).
 * It never stores or logs a phone number — it only classifies the shape of one
 * on its way to Supabase Auth, which is the sole durable store (§6 identity
 * invariant, `Docs/DECISIONS.md` — no application table holds a phone column,
 * enforced for the whole migration set by `tests/sql-migration-harness.test.mjs`).
 */

/** Supabase Auth's own phone format: E.164, no separators. */
const E164 = /^\+[1-9]\d{7,14}$/

const OTP_CODE = /^\d{6}$/

export function isE164Phone(value: unknown): value is string {
  return typeof value === 'string' && E164.test(value)
}

/**
 * Best-effort normalisation for the common case this pilot actually serves —
 * a Northern Virginia commuter typing a 10-digit US number with no country
 * code, with or without the punctuation a phone keypad's autofill adds. Any
 * input that already looks like E.164 is passed through unchanged rather than
 * reinterpreted; anything else that is not clearly a US number is refused
 * rather than guessed, because a wrong country code is a wrong phone number.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const digitsOnly = raw.trim().replace(/[\s().-]/g, '')

  if (isE164Phone(digitsOnly)) return digitsOnly
  if (/^\d{10}$/.test(digitsOnly)) return `+1${digitsOnly}`
  if (/^1\d{10}$/.test(digitsOnly)) return `+${digitsOnly}`

  return null
}

export function isOtpCode(value: unknown): value is string {
  return typeof value === 'string' && OTP_CODE.test(value)
}

/**
 * Phone-shaped substrings inside free text — a run of digits and the
 * separators a phone keypad's autofill adds, long enough to be a number and
 * short enough not to swallow a sentence. `normalizePhone` (above) is the
 * arbiter of "is this actually a phone number": a candidate that does not
 * normalise is text this function leaves alone, so "2 seats at 3:15" is never
 * mistaken for one. The leading `[+(]?` / trailing `\)?` admit a US area
 * code's parentheses without pulling them into the digit-count decision —
 * `normalizePhone` strips them the same way it strips any other separator.
 */
const PHONE_CANDIDATE = /[+(]?\d[\d\s().-]{6,}\d\)?/g

/** A bare `local@domain` email, redacted the same way — no normalisation step needed, the shape is the whole test. */
const EMAIL_CANDIDATE = /[\w.+-]+@[\w-]+\.[\w.-]+/g

/**
 * Redacts phone numbers and email addresses out of member free text before it
 * is written anywhere durable.
 *
 * Exists because `0001`'s identity invariant — Supabase Auth is the only
 * durable phone store, application tables hold opaque UUIDs — has no code-level
 * guard on `agent_traces.user_message`: a member typing their number into a
 * chat turn stores it there verbatim, permanently, alongside a `member_id` that
 * already identifies them. This is the guard, run once here rather than at
 * every call site that inserts member-authored text.
 */
export function redactPii(text: string): string {
  return text.replace(PHONE_CANDIDATE, (match) => (normalizePhone(match) ? '[redacted-phone]' : match)).replace(
    EMAIL_CANDIDATE,
    '[redacted-email]'
  )
}
