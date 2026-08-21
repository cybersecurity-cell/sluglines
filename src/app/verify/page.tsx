import { redirect } from 'next/navigation'
import VerifyForm from '@/components/VerifyForm'

/**
 * `/verify` — rev. 5.3 §8 M2. Reached only from `/login`, with the phone
 * number carried in the query string (never a session or a server-side
 * store — nothing here is durable until the code is verified).
 *
 * No phone in the URL means this page was reached directly rather than via
 * `/login`'s redirect; there is nothing to verify, so it sends the visitor
 * back rather than rendering a code field with no destination.
 */
export const metadata = {
  title: 'Enter your code - Sluglines',
  description: 'Enter the 6-digit code we texted you.',
}

export default function VerifyPage({ searchParams }: { searchParams?: { phone?: string } }) {
  const phone = searchParams?.phone
  if (!phone) {
    redirect('/login')
  }

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
        <VerifyForm phone={phone} />
      </div>
    </div>
  )
}
