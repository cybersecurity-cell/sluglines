# Supabase Auth configuration — `bwpguotjzczmieeepczf`, 2026-08-22

The artifact issue #24 asks for. **A record, not a living document**: it is the configuration as it
stood on this date, captured either side of the change. It is never edited again; a later change
gets a later record.

Read from `GET /v1/projects/bwpguotjzczmieeepczf/config/auth`. **No secret value appears here** —
credential-shaped fields are reported as set or unset only.

## Changed by this slice

| Setting | Before | After | Why |
|---|---|---|---|
| `sms_max_frequency` | `5` | **`60`** | D-8's resend cooldown, exactly. Five seconds between sends is an SMS-pumping cost surface (§14 risk 11). |
| `rate_limit_verify` | `30` | **`10`** | An attempt cap. See the note below on why it is not 5. |

## Unchanged, and read as evidence

| Setting | Value | Reading |
|---|---|---|
| `external_phone_enabled` | **`false`** | **Phone auth is switched off in production.** The whole M2 identity surface — `/login`, `/verify`, `/onboarding`, both `/api/auth/*` routes — cannot function. |
| `sms_provider` | `twilio` | Configured but unreachable while the above is false. |
| `sms_test_otp` | **`null`** | **No test-OTP ranges exist.** Nothing to disable; the requirement is satisfied by absence. |
| `sms_test_otp_valid_until` | `null` | Consistent with the above. |
| `sms_autoconfirm` | `false` | A code is always required; no phone is trusted unverified. |
| `sms_otp_length` | `6` | |
| `sms_otp_exp` | `60` | Sixty seconds. Short for real SMS delivery — flagged, not changed; it is not one of D-8's controls. |
| `security_captcha_enabled` | `false` | |
| `security_captcha_provider` | `hcaptcha` | Provider selected… |
| `security_captcha_secret` | **unset** | …but **no credential exists**, so CAPTCHA cannot be enabled. Reported pending, which #24 explicitly permits. |
| `rate_limit_otp` | `30` | Per hour. The per-IP **daily** cap is edge middleware and out of scope here. |
| `rate_limit_sms_sent` | `30` | Per hour. |
| `mailer_autoconfirm` | `false` | |
| `disable_signup` | `false` | |

## Why `rate_limit_verify` is 10 and not D-8's 5

D-8 specifies **≤ 5 verify attempts per number per hour**. GoTrue's knob is **per IP**, not per
number — they are different controls and substituting one for the other silently would be the kind
of "looks satisfied" this repo keeps refusing.

At 5/hour/IP, a carrier CGNAT pool or a shared office network would lock out legitimate commuters
after a handful of collective attempts, on the app whose entire audience is people on mobile
networks. 10/hour/IP is a third of the previous ceiling, comfortably above what a real user needs
(a mistyped code, twice), and does not break shared egress.

**The per-number cap D-8 actually asks for remains enforced only by `src/lib/api/rate-limit.ts`**,
which is in-memory, single-process and resets on redeploy — D-36 says so in as many words. It is
defence-in-depth, not the durable control, and it is not closed by this record.

## Evidence: no test range grants a session

Run against the live project on 2026-08-22, anonymous key, canonical test-range number:

```
POST /auth/v1/verify  {"type":"sms","phone":"+15555550100","token":"123456"}
  403  {"error_code":"otp_expired","msg":"Token has expired or is invalid"}

POST /auth/v1/otp     {"phone":"+15555550100"}
  400  {"error_code":"phone_provider_disabled","msg":"Unsupported phone provider"}
```

The first is the direct evidence #24 asks for: a test-range code is refused, and refused with a
**generic** message that does not distinguish "wrong code" from "no such number" (T10
anti-enumeration, the same posture `src/lib/api/otp-http.ts` enforces on the app side).

The second is the finding: phone sends fail because the provider is disabled, not because of any
control applied here.
