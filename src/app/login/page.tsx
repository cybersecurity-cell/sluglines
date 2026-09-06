import LoginForm from '@/components/LoginForm'
import SignInUnavailable from '@/components/SignInUnavailable'
import { isPhoneAuthEnabled } from '@/lib/api/phone-auth-availability.ts'
import { safeNextPath } from '@/lib/domain/auth-return.ts'

/**
 * `/login` — rev. 5.3 §8 M2. Phone entry only; the code goes to `/verify`.
 *
 * rev. 5.3 §7.1 risk 9 keeps this page out of the read path entirely: nothing
 * before this route requires a session, and nothing links here except an
 * explicit "sign in" affordance. `/spots` and the fast board's public counts
 * need no account.
 *
 * A7: the phone-auth-off check runs here, server-side, before either form or
 * unavailable state renders — not inside `LoginForm` itself, which would mean
 * a client-side round trip and a flash of the interactive form before it
 * resolves.
 *
 * `?next=` (issue #136): the page a signed-out visitor was sent here from —
 * `/board`, a spot page — is carried through `/verify` and `/onboarding` and
 * honoured at the end, so a rider who wanted the board lands on the board.
 * Sanitised here by `safeNextPath` (same-origin path only) and again at every
 * redirect that consumes it.
 */
export const metadata = {
  title: 'Sign in - Sluglines',
  description: 'Sign in with your phone number.',
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const [available, resolvedSearchParams] = await Promise.all([isPhoneAuthEnabled(), searchParams])
  const next = safeNextPath(resolvedSearchParams?.next)

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Sign in</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Sign in with your phone
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            No password. We text a 6-digit code to confirm it&apos;s you.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Other sluggers never see your number. It stays with sign-in; members see only the display name you
            choose.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-xl px-4 py-8">{available ? <LoginForm next={next} /> : <SignInUnavailable />}</div>
    </div>
  )
}
