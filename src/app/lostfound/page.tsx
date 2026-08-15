import Link from 'next/link'
import { PackageSearch } from 'lucide-react'

export const metadata = {
  title: 'Lost & Found - Sluglines',
  description:
    'The Sluglines Lost & Found board for items left in a slug line carpool. Publicly readable; reporting and claiming require an account.',
}

/**
 * `/lostfound` — the landing target of the legacy forum 301s.
 *
 * M5 owns this board (rev. 5.3 §8 M5) and it is §11 Phase 3 work: the
 * `lostfound_*` tables do not exist in this repo's migrations yet. This page is
 * the **M1 half only** — the route has to resolve, because the §8 M1 redirect
 * policy sends `/forum/` and every legacy Lost & Found URL here, and a 301 into
 * a 404 loses exactly the traffic §3.1 decided to keep. It states what the board
 * will be and what has happened to the old one; it does not pretend to be a
 * board.
 *
 * The reason this page cannot honestly show items yet is the same reason it
 * exists: L&F is the only live legacy usage (116 topics, newest two days old),
 * and none of it is migrated.
 */
export default function LostFoundPage() {
  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Lost &amp; Found</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Left something in a slug line carpool?
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            The Lost &amp; Found board is the one part of the old Sluglines forum that carries over. It is not open
            yet — when it is, anyone will be able to read it without an account, and reporting or claiming an item
            will need one.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <PackageSearch aria-hidden className="h-5 w-5 text-sky-700" />
              What happened to the old board
            </h2>
            <p className="mt-2 text-slate-700">
              Topics on the legacy forum are not being migrated. The old board stays readable during the changeover so
              anything in flight can conclude, and every legacy Lost &amp; Found link now points here.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/spots"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800"
            >
              Browse slug pickup locations
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              How slugging works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
