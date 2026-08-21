import CheckInStatusPanel from '@/components/CheckInStatusPanel'
import FastBoard from '@/components/FastBoard'
import { buildFastBoard } from '@/lib/domain/fast-board'
import { getMemberPresence, getPublicSpotCounts } from '@/lib/dashboard'

/**
 * `/dashboard` — the M3 power-user view (rev. 5.3 §8 M3).
 *
 * One screen for the frequent commuter: their own check-in and its one-tap
 * checkout at the top, every active line with live counts underneath, ordered
 * busiest first.
 *
 * Rendered per request, and rendered on the *server*. The page it replaces was a
 * client component that mounted, opened a realtime channel, and issued two
 * selects against `riders` and `drivers` — tables D-13 dropped — before it could
 * paint anything. So it was slow for exactly the user it was built for and, once
 * it did paint, showed a column of zeros that was indistinguishable from a quiet
 * morning. Both halves are fixed here: the counts are in the HTML, and they come
 * from the §8 M1 aggregate functions, which report `unavailable` when they are
 * not deployed rather than reporting zero.
 *
 * The two reads are independent — the board does not wait on the presence row —
 * so they are issued together rather than in sequence.
 *
 * `?checkout=failed` is set by `clearPresence()` when the checkout call did not
 * land. It is a URL flag rather than client state because the whole surface,
 * including the button, is server-rendered.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Fast Board - Sluglines',
  description:
    'Every active Northern Virginia slug line with live rider and driver counts, your current check-in, and one-tap checkout.',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { checkout?: string }
}) {
  const [snapshot, presence] = await Promise.all([getPublicSpotCounts(), getMemberPresence()])

  const board = buildFastBoard(snapshot, { checkedInSlug: presence.spotSlug ?? null })

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Fast board</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Every line, one screen
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Built for the commuter who checks the same board twice a day: counts for all active spots,
            busiest first, plus your current check-in and a single tap to clear it.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <CheckInStatusPanel presence={presence} checkoutFailed={searchParams?.checkout === 'failed'} />
        <FastBoard board={board} />
      </div>
    </div>
  )
}
