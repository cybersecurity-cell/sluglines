import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SPOT_CORRIDORS, SPOT_LOCATIONS } from '@/lib/domain/locations'
import { RESOURCE_MODULES } from '@/lib/site-content'
import { getActiveSpotLocations } from '@/lib/spot-directory'

/**
 * Editorial kicker per resource module, keyed by the data-driven `title` so
 * `RESOURCE_MODULES` (tested by `tests/site-content.test.mjs`) stays the
 * single source for titles/hrefs/descriptions; this file only adds the
 * one-idea-per-section framing on top of it.
 */
const KICKERS: Record<string, string> = {
  'Slug Pickup': 'Find the line',
  'Rules & Etiquette': 'Know the etiquette',
  'Blog & News': 'Follow commuter updates',
  'Mobile App': 'Use the board when it is live',
}

export default function InfoModuleGrid() {
  const [featured, ...rest] = RESOURCE_MODULES
  const activeSpots = getActiveSpotLocations().length
  const activeLocations = SPOT_LOCATIONS.filter((location) => location.active)
  const morningCount = activeLocations.filter((location) => location.direction === 'Morning').length
  const afternoonCount = activeLocations.filter((location) => location.direction === 'Afternoon').length
  const corridorCounts = SPOT_CORRIDORS.map((corridor) => ({
    corridor,
    activeSpots: activeLocations.filter((location) => location.corridor === corridor).length,
  }))

  return (
    <section className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
            Around the commute
          </p>
          <h2 className="h-display text-3xl text-[#17202A]">Four things worth knowing</h2>
          <p className="mt-2 text-slate-600">
            Sluglines is a reference first: where lines run, how they work, and what is changing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:grid-rows-3">
          {featured && (
            <Link
              href={featured.href}
              className="group flex flex-col justify-between rounded-lg bg-[#17202A] p-7 text-white transition-colors hover:bg-[#0f151d] lg:col-span-7 lg:row-span-3"
            >
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#7bc994]">
                  {KICKERS[featured.title] ?? featured.title}
                </p>
                <h3 className="h-display mt-3 text-2xl">{featured.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">{featured.description}</p>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                  <div>
                    <p className="font-mono text-2xl font-bold text-white">{morningCount}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Morning lines running
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-bold text-white">{afternoonCount}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Afternoon lines running
                    </p>
                  </div>
                </div>

                <ul className="mt-5 space-y-2">
                  {corridorCounts.map((entry) => (
                    <li
                      key={entry.corridor}
                      className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-white">{entry.corridor}</span>
                      <span className="font-mono text-xs text-slate-400">{entry.activeSpots} active</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                <p className="leading-none">
                  <span className="font-mono text-3xl font-bold">{activeSpots}</span>
                  <span className="ml-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    active spots, two corridors
                  </span>
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-white">
                  Open
                  <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )}

          {rest.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="group flex flex-col justify-between rounded-lg border border-stone-200 p-6 transition-colors hover:border-[#2E7D46]/40 hover:bg-[#FAFAF8] lg:col-span-5"
            >
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
                  {KICKERS[module.title] ?? module.title}
                </p>
                <h3 className="h-display mt-2 text-lg text-[#17202A]">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2E7D46] group-hover:text-[#1f5c33]">
                Open
                <ArrowRight aria-hidden className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
