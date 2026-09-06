import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SignInUnavailable from '@/components/SignInUnavailable'
import VerifyForm from '@/components/VerifyForm'
import { isPhoneAuthEnabled } from '@/lib/api/phone-auth-availability.ts'
import { OTP_PHONE_COOKIE, safeNextPath } from '@/lib/domain/auth-return.ts'

/**
 * `/verify` — rev. 5.3 §8 M2. Reached only from `/login`, with the phone
 * number carried in the short-lived httpOnly cookie `POST /api/auth/send-otp`
 * set (issue #136 — it used to be the query string, which put the number in
 * browser history and every request log). Nothing here is durable until the
 * code is verified; the cookie expires on its own.
 *
 * No phone cookie means this page was reached directly, or the ten minutes
 * ran out; there is nothing to verify, so it sends the visitor back rather
 * than rendering a code field with no destination. `?next=` is carried on.
 *
 * A7: mirrors `/login`'s phone-auth-off check — reachable directly by URL
 * (e.g. a bookmarked or shared link) without ever passing through `/login`,
 * so the same server-side gate has to run here too, not only there.
 */
export const metadata = {
  title: 'Enter your code - Sluglines',
  description: 'Enter the 6-digit code we texted you.',
}

export default async function VerifyPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const [cookieStore, resolvedSearchParams] = await Promise.all([cookies(), searchParams])
  const phone = cookieStore.get(OTP_PHONE_COOKIE)?.value
  const next = safeNextPath(resolvedSearchParams?.next)
  if (!phone) {
    redirect('/login')
  }

  const available = await isPhoneAuthEnabled()

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Sign in</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Enter your code</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Check your texts for a 6-digit code.</p>
        </div>
      </section>

      <div className="mx-auto max-w-xl px-4 py-8">
        {available ? <VerifyForm phone={phone} next={next} /> : <SignInUnavailable />}
      </div>
    </div>
  )
}
