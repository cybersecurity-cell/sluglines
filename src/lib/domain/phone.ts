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
