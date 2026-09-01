import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { CorridorStatus, PublicCountsAvailability } from '@/lib/domain/public-counts'
import { HOMEPAGE_STATS } from '@/lib/site-content'

interface SiteHeroProps {
  statuses: CorridorStatus[]
  availability: PublicCountsAvailability
}

/**
 * The §8 M1 hero. Its primary CTA points at `/spots` — the canonical directory
 * route in the M1 route table. It used to point at `/slug_pickup`, the legacy
 * path; that page still exists, but sending the front page's main action
 * through a legacy URL is how a legacy URL never gets retired.
 *
 * The right-hand panel previews the DIRECTORY — corridor names and how many
 * active lines each one has — never live rider/driver numbers. §10's honesty
 * rule applies to a hero panel exactly as it applies to the strip: an empty slot
 * says the counts are not switched on, it does not get filled with a plausible
 * number.
 *
 * `statuses` arrives already computed from the page rather than being derived
 * here a second time. The hero and the strip below it print the same totals from
 * the same call, so there is no arrangement of the directory in which the two
 * can disagree — which is the only interesting property this panel has.
 */
export default function SiteHero({ statuses, availability }: SiteHeroProps) {
  const activeSpots = statuses.reduce((total, status) => total + status.activeSpots, 0)
  const isLive = availability === 'live'

  return (
    <section className="border-b border-stone-200 bg-[#FAFAF8]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-7">
            <p className="mb-4 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#2E7D46]" />
              Northern Virginia &middot; I-95 &middot; I-395 &middot; I-66
            </p>
            <h1 className="h-display max-w-xl text-4xl text-[#17202A] sm:text-5xl md:text-[3.35rem] md:leading-[1.05]">
              Know where to stand before you leave the house.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-700">
              Sluglines is the directory for Northern Virginia&rsquo;s slug lines &mdash; where riders queue, where
              drivers pull up, and what it costs (nothing). No account needed to look.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/spots"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#2E7D46] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#245f37]"
              >
                Find a pickup spot
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-[#17202A] transition-colors hover:bg-stone-50"
              >
                Learn how slugging works
              </Link>
            </div>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-6 border-t border-stone-200 pt-6">
              {HOMEPAGE_STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-slate-500">{stat.label}</dt>
                  <dd className="mt-1 text-sm font-bold text-[#17202A]">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-dashed border-stone-300 px-5 py-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Corridor directory
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500">{activeSpots} active lines</span>
              </div>
              <div className="divide-y divide-dashed divide-stone-200">
                {statuses.map((status) => (
                  <div key={status.corridor} className="flex items-center gap-4 px-5 py-4">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#2E7D46]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#17202A]">{status.corridor}</p>
                      <p className="text-xs text-slate-500">
                        {status.directions
                          .filter((direction) => direction.activeSpots > 0)
                          .map((direction) => `${direction.activeSpots} ${direction.direction.toLowerCase()}`)
                          .join(' · ')}
                      </p>
                    </div>
                    <p className="font-mono text-lg font-bold text-[#17202A]">{status.activeSpots}</p>
                  </div>
                ))}
              </div>
              {/*
                One sourced fact and one honest statement about the counts. The
                morning window is the same 5:30–9:30 that CorridorStatusStrip,
                FastBoard and SpotLiveCounts already print; the afternoon window
                this panel used to claim ("3:30–6:30 PM outbound") had no source
                anywhere in the repo, which is the same class of invention §10
                forbids for the counts themselves.
              */}
              <div className="border-t border-dashed border-stone-300 px-5 py-4">
                <p className="text-xs leading-relaxed text-slate-600">
                  Morning peak is <span className="font-semibold text-[#17202A]">5:30–9:30</span>.{' '}
                  {isLive
                    ? 'Live rider and driver counts are shown for each corridor below.'
                    : 'Live rider and driver counts are not switched on yet — the board below shows the directory.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
