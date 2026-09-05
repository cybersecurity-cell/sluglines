/**
 * Whether phone sign-in is switched on — read live from Supabase Auth's own
 * public settings endpoint, not a new environment variable.
 *
 * A7 asks for a "sign-in unavailable" state rendered *before* the form,
 * detected some way that doesn't invent a fourth env var. `GET
 * {SUPABASE_URL}/auth/v1/settings` is GoTrue's own runtime config surface —
 * the same one its client SDKs consult to decide which providers to show —
 * and it reports `external.phone` for exactly the `external_phone_enabled`
 * flag Docs/2026-08-22-supabase-auth-config.md and D-51 read from the
 * Management API by hand. It needs only `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 * already required and already public, so this has no dependency on
 * `SUPABASE_SERVICE_ROLE_KEY` (A11) — the two checks fail independently.
 *
 * A new env var was rejected specifically because it is a second, disconnected
 * place to keep in sync with the GoTrue dashboard setting — precisely the
 * "looks satisfied" drift D-51 already warns about for this project. Reading
 * the live setting cannot drift from itself.
 *
 * Fails OPEN (reports enabled) on any network or parse failure: a health-check
 * hiccup on this endpoint must not hide the entire sign-in surface behind an
 * "unavailable" banner for every visitor. If phone auth is genuinely off and
 * this check wrongly said otherwise, `send-otp-route.ts`'s classification of
 * GoTrue's own `phone_provider_disabled` response (`otp-http.ts`) is the
 * fallback a visitor still hits after submitting.
 *
 * `fetchImpl` is a parameter for the same reason `RateLimitRpcClient` is one in
 * `durable-rate-limit.ts`: a test drives it without a real network call.
 */
export async function isPhoneAuthEnabled(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return true

  try {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      next: { revalidate: 60 },
    })
    if (!response.ok) return true

    const settings = (await response.json()) as { external?: { phone?: boolean } }
    return settings?.external?.phone !== false
  } catch {
    return true
  }
}
