import LoginForm from '@/components/LoginForm'

/**
 * `/login` — rev. 5.3 §8 M2. Phone entry only; the code goes to `/verify`.
 *
 * rev. 5.3 §7.1 risk 9 keeps this page out of the read path entirely: nothing
 * before this route requires a session, and nothing links here except an
 * explicit "sign in" affordance. `/spots` and the fast board's public counts
 * need no account.
 */
export const metadata = {
  title: 'Sign in - Sluglines',
  description: 'Sign in with your phone number.',
}

export default function LoginPage() {
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
        </div>
      </section>

      <div className="mx-auto max-w-xl px-4 py-8">
        <LoginForm />
      </div>
    </div>
  )
}
