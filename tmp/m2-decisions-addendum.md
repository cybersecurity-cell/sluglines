
---

## D-34 — Phone-OTP identity (M2): two JSON routes, one new writer, and a session-only onboarding page

**Decision:** rev. 5.3 §8 M2 ships as two `/api/auth/*` route handlers over Supabase Auth's phone
OTP (`signInWithOtp` / `verifyOtp`), a new SECURITY DEFINER writer (`set_home_spot`, `0006`), and
three pages (`/login`, `/verify`, `/onboarding`) that hand off to each other by URL, not by shared
client state.

### Why two JSON routes, not a Server Action, for the OTP exchange

Every other write in this app (`clearPresence()`, the M3 transitions) is a Server Action or a
route handler reached by a same-origin `<form>`, chosen specifically to avoid shipping
`@supabase/ssr` to the browser (D-33's 62 kB/162 kB → 1.11 kB/97.1 kB figure). The OTP exchange
breaks that pattern on purpose:

- The task this slice was scoped from asks for `/api/auth/send-otp` and `/api/auth/verify-otp` as
  a stable, machine-readable contract — not only a page that happens to work.
- A plain `<form action="...">` POSTs as `x-www-form-urlencoded`/`multipart`, not JSON; supporting
  it would mean a second body-parsing path in every handler for a flow that is inherently
  multi-step (send, wait, receive a text, type a code, get told it was wrong) and already needs
  client JS for a usable resend timer and inline error text. The "works with JS off" argument that
  justified a Server Action for checkout does not transfer cleanly here, so it was not forced.
- `LoginForm.tsx` and `VerifyForm.tsx` are therefore the only two client components this slice
  adds. Both `fetch()` the JSON routes and hold no Supabase import — the client never sees a
  service key or talks to Supabase directly, only to this app's own routes.

### Anti-enumeration (D-8, threat T10) has a smaller job than it looks like

Phone OTP has no separate "sign up" step — `signInWithOtp` creates the `auth.users` row
transparently on first use — so there is no "does this number already have an account" branch for
`/api/auth/send-otp` to leak in the first place; its success body is unconditionally `{ ok: true }`
(asserted in `auth-otp-routes.test.mjs`). What the anti-enumeration discipline actually buys here is
narrower and still real: `otp-http.ts` classifies every Supabase Auth error into one of four kinds
(`invalid_argument` / `invalid_code` / `rate_limited` / `unavailable`) and authors its own message
for each, the same D-30 rule `transition-http.ts` set for the M3 write path — GoTrue's raw error
text is never forwarded to the client.

### Rate limiting is honestly scoped, not fully built

D-8 assigns "≤10 OTP sends per IP per day" to **edge middleware, built in P2** — the same deferral
`0005_public_aggregates.sql`'s own header records ("a SQL function cannot see caller IPs"). This
slice does not build that. `lib/api/rate-limit.ts` is an in-memory, single-process, fixed-window
limiter: 5 sends/hour and 5 verify-attempts/hour per phone number (the D-8 number, applied to
verify), 10 sends/hour and 20 verify-attempts/hour per IP. It resets on every redeploy and does not
coordinate across instances — read as defence-in-depth on top of Supabase Auth's own per-number
limits and 60s resend cooldown (dashboard config, still D-8 `PENDING`), not as the durable control.
The module's own header says this in as many words, so a later session does not mistake it for the
P2 work.

### `set_home_spot(uuid)` — 0006, and why it waits on 0004 the same way 0005 did

`members.location_id` has carried no writer since 0001 ("`set_display_name` is the only
client-reachable write to members ... Note what it cannot touch: role and location_id"). `0006`
adds the other one: SECURITY DEFINER, `auth.uid()`-scoped, and it re-validates
`locations.is_active` itself rather than trusting the client only ever submits an id the picker
showed it — rev. 5.3 §8 M3's "only active locations ... can be selected as home" is enforced
server-side, not merely by the `<select>` options. Like 0005, it cannot mean anything until 0004
(`locations`) is applied — there is nothing to look up `is_active` on until then.

### The home-spot picker degrades the same way the dashboard's presence panel does

`locations` (0004) is unapplied everywhere, so `getActiveHomeSpotOptions()` (`lib/onboarding.ts`)
resolves to `[]` today rather than throwing — the same "unresolved is a first-class outcome"
discipline `lib/dashboard.ts` uses for the same table (D-33). The onboarding form's home-spot field
is **absent**, not merely empty, when the list is empty, and the field is optional either way: a
visitor completes onboarding with just a display name. Once 0004 is applied, the field appears with
no UI change, the same "turns live the moment the migration lands" property D-33 records for the
board.

### Where the session comes from

`verify-otp-route.ts` uses the cookie-bound server client (`lib/supabase/server.ts`), so a
successful `verifyOtp()` writes the session cookie through the same adapter every M3 write route's
`getUser()` reads from — there is no separate "log the member in" step distinct from verifying the
code. `/onboarding` requires that session (redirects to `/login` otherwise); `/login` and `/verify`
do not, and nothing before `/onboarding` in this flow requires one — rev. 5.3 §7.1 risk 9 ("OTP wall
in front of reading") stays satisfied because `/spots` and the aggregates were never behind this
gate to begin with.

### A pre-existing gap this slice closed in passing

`npm run test` was **red on this branch before this slice touched anything**:
`tests/sql-migration-harness.test.mjs`'s global "every `grant execute` targets `authenticated`
only" assertion was never updated when `0005_public_aggregates.sql` landed (`bfab2c6`), and that
migration deliberately grants its two functions to `anon` too (R10's own named exception). The
assertion now reads `ANON_CALLABLE_FUNCTIONS` — `sql-lint.mjs`'s own allowlist — instead of a
blanket `['authenticated']`, so the exception is checked rather than merely permitted. This is not
new scope; `npm run test` had to be green for this slice's own gate to mean anything, and the fix
is two lines against a list the analyser already exports.

**Status:** DONE for what a static harness and a preview-less database can prove. Not proven
against a live database — see "Not done" in the slice record below.
