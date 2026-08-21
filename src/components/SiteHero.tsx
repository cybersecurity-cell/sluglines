import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'
import { SPOT_LOCATIONS } from '@/lib/domain/locations'

/**
 * The §8 M1 hero. Its primary CTA points at `/spots` — the canonical directory
 * route in the M1 route table. It used to point at `/slug_pickup`, the legacy
 * path; that page still exists, but sending the front page's main action
 * through a legacy URL is how a legacy URL never gets retired.
 */
export default function SiteHero() {
  const activeSpots = SPOT_LOCATIONS.filter((location) => location.active).length

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700">
          Northern Virginia casual carpooling guide
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          Find slug lines, rules, destinations, and live commuter updates.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
          Sluglines helps riders and drivers understand where to line up, how slugging works, and what is happening at
          active pickup spots. {activeSpots} lines across the I-395 / I-95 and I-66 corridors, no account needed to look.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/spots"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800"
          >
            <Search aria-hidden className="h-4 w-4" />
            Find a pickup spot
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <MapPin aria-hidden className="h-4 w-4" />
            Learn how slugging works
          </Link>
        </div>
      </div>
    </section>
  )
}
