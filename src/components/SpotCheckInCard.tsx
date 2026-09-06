import Link from 'next/link'
import CheckInButton from '@/components/CheckInButton'
import CheckOutButton from '@/components/CheckOutButton'
import { checkInAtSpot, checkOutFromSpot } from '@/app/spots/actions'
import type { CheckInOutcome, CheckOutOutcome } from '@/app/spots/actions'
import type { MemberPresence } from '@/lib/domain/fast-board'
import { toPresenceDirection } from '@/lib/domain/fast-board'

interface SpotCheckInCardProps {
  spot: {
    slug: string
    routeSlug: string
    name: string
    /** The directory's `Morning`/`Afternoon`; lower-cased for the table by `toPresenceDirection`. */
    direction: string
    isActive: boolean
  }
  presence: MemberPresence
  checkIn?: CheckInOutcome
  checkOut?: CheckOutOutcome
}

/**
 * The M4 presence control, on the one page a slugger is looking at when they
 * join a line (issue #135). Before this, `/board`'s empty state sent people to
 * `/dashboard` to check in, `/dashboard` sent them to `/spots`, and the spot
 * page had nothing — three surfaces linking in a circle around a function
 * (`presence_checkin`, `0001`) nothing in `src/` called.
 *
 * Server-rendered; the two buttons are `<form action={...}>` submits to
 * `app/spots/actions.ts`. The states follow `CheckInStatusPanel`'s rule that
 * `signed-out` and `unavailable` never claim "you are not checked in".
 */
export default function SpotCheckInCard({ spot, presence, checkIn, checkOut }: SpotCheckInCardProps) {
  const direction = toPresenceDirection(spot.direction)
  const checkedInHere = presence.state === 'checked-in' && presence.spotSlug === spot.slug
  const checkedInElsewhere = presence.state === 'checked-in' && presence.spotSlug !== spot.slug

  return (
    <section aria-labelledby="spot-check-in-heading" className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 id="spot-check-in-heading" className="h-display text-lg text-[#17202A]">
        Check in
      </h2>

      {checkIn === 'ok' && (
        <p role="status" className="mt-3 rounded-lg border border-[#2E7D46]/30 bg-[#EAF2ED] p-3 text-sm font-semibold text-[#1F5C33]">
          Checked in. Drivers now see one more rider waiting here.
        </p>
      )}
      {checkIn === 'failed' && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Check-in did not go through. You are not checked in here — try again.
        </p>
      )}
      {checkIn === 'unavailable' && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          This spot&apos;s directory record could not be read, so check-in is off here for now.
        </p>
      )}
      {checkOut === 'failed' && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Check-out did not go through. You are still checked in — try again.
        </p>
      )}
      {checkOut === 'ok' && (
        <p role="status" className="mt-3 rounded-lg border border-stone-200 bg-[#FAFAF8] p-3 text-sm font-semibold text-slate-700">
          Checked out.
        </p>
      )}

      {!spot.isActive ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          This line is not believed to be running, so there is no check-in here.
        </p>
      ) : presence.state === 'signed-out' ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-slate-700">
            Sign in to check in. Drivers see the count of riders waiting, never who you are.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/spots/${spot.routeSlug}`)}`}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#2E7D46] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#245F37]"
          >
            Sign in to check in
          </Link>
        </div>
      ) : presence.state === 'unavailable' ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Your check-in status could not be read just now, so this card is not saying whether you are
          checked in. Reload in a moment.
        </p>
      ) : checkedInHere ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-slate-700">
            You are checked in here
            {typeof presence.minutesRemaining === 'number' && (
              <>
                {' '}
                for another {presence.minutesRemaining} {presence.minutesRemaining === 1 ? 'minute' : 'minutes'}
              </>
            )}
            . Check in again to extend, or check out when you have a ride.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {direction && (
              <form action={checkInAtSpot}>
                <input type="hidden" name="slug" value={spot.slug} />
                <input type="hidden" name="route_slug" value={spot.routeSlug} />
                <input type="hidden" name="direction" value={direction} />
                <CheckInButton spotName={spot.name} />
              </form>
            )}
            <form action={checkOutFromSpot}>
              <input type="hidden" name="route_slug" value={spot.routeSlug} />
              <CheckOutButton />
            </form>
          </div>
        </div>
      ) : direction ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-slate-700">
            {checkedInElsewhere && presence.spotName
              ? `You are checked in at ${presence.spotName}. Checking in here moves you.`
              : 'Let drivers know a rider is waiting. Your check-in expires on its own after 20 minutes.'}
          </p>
          <form action={checkInAtSpot} className="mt-3">
            <input type="hidden" name="slug" value={spot.slug} />
            <input type="hidden" name="route_slug" value={spot.routeSlug} />
            <input type="hidden" name="direction" value={direction} />
            <CheckInButton spotName={spot.name} />
          </form>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          This spot&apos;s direction is not one the check-in table accepts, so there is no check-in here.
        </p>
      )}
    </section>
  )
}
