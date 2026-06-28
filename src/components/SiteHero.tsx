import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'

export default function SiteHero() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700">
          Northern Virginia casual carpooling guide
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          Find slug lines, rules, destinations, and live commuter updates.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Sluglines helps riders and drivers understand where to line up, how slugging works, and what is happening at active pickup spots.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/spots"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800"
          >
            <Search className="h-4 w-4" />
            Search pickup locations
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <MapPin className="h-4 w-4" />
            Learn how slugging works
          </Link>
        </div>
      </div>
    </section>
  )
}
