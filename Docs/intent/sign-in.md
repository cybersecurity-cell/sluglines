# Intent: sign-in

A phone number, a six-digit code, a display name, an optional home spot. Nothing else identifies a member. rev. 5.3 §8 M2; D-8 (cooldowns), D-45/D-51/D-66 (rate limits), D-80 (per-IP cap placement), D-86 (return path, onboarding once, phone cookie).

## Why

The wedge principle: reading is free, acting needs an account, and the account must cost less than a WhatsApp join. A phone code is the least a stranger can be asked for and the most a driver needs to trust that a rider is a person.

## Decisions

- **Sign-in gates actions, never looking.** `/spots`, the counts and the archive are public; `/board`, check-in and the dashboard need a session. *Rejected:* an OTP wall in front of reading (§7.1 risk 9).
- **The phone never travels in a URL.** `send-otp` sets a ten-minute httpOnly cookie; `/verify` reads it server-side; `verify-otp` clears it (D-86). *Rejected:* the query string (history, referrers, logs); `sessionStorage` (moves the server-side guard into the client).
- **`next` is a same-origin path or nothing**, sanitised once in `lib/domain/auth-return.ts` and again at every consumer (D-86). *Rejected:* any absolute URL on the site's host.
- **Onboarding runs once.** A member whose display name is no longer `handle_new_member()`'s placeholder skips it (D-86).
- **Refusals are honest.** `unavailable` says the fault is ours; the same generic message covers a number that has and has not signed in before (anti-enumeration); the resend cooldown is visible, not discovered.

## Invariants

- Other members never see a phone number; `members` has no client write policy and `set_display_name` is the only member-reachable write.
- Every OTP send is rate-limited per number and per IP, durably (D-66), and fails closed if the durable limiter cannot be constructed (A11).
- No route, action or page re-derives an authorization decision the SQL makes.

## Done

A person on the deployed site opens `/board` signed out, signs in, lands on `/board`; signs in again and does not see `/onboarding`; sees the countdown on `/verify`. Evidence on #136. Needs #47 and #52 (a provider that can send the code).
