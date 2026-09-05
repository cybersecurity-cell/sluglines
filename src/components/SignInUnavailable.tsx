/**
 * A7's third sign-in state: rendered by `/login` and `/verify` *instead of*
 * `LoginForm`/`VerifyForm` when `isPhoneAuthEnabled()` (`phone-auth-
 * availability.ts`) reports phone sign-in as off, so a visitor never sees an
 * interactive form for a feature that cannot work, nor has to submit it first
 * to find out. No `'use client'`: this is static copy, no state, no fetch of
 * its own — the page server component already did the one check that decides
 * whether this renders at all.
 */
export default function SignInUnavailable() {
  return (
    <div role="status" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-bold">Sign-in isn&apos;t available right now.</p>
      <p className="mt-1">We can&apos;t text verification codes at the moment. Please check back later.</p>
    </div>
  )
}
