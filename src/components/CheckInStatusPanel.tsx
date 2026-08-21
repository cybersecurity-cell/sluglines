import Link from 'next/link'
import { MapPin } from 'lucide-react'
import CheckOutButton from '@/components/CheckOutButton'
import { clearPresence } from '@/app/dashboard/actions'
import type { MemberPresence } from '@/lib/domain/fast-board'
import { presenceDirectionLabel } from '@/lib/domain/fast-board'
import { formatRelativeTime } from '@/lib/checkins'

interface CheckInStatusPanelProps {
  presence: MemberPresence
  /** Set when the previous checkout attempt failed — see `dashboard/actions.ts`. */
  checkoutFailed?: boolean
}

/**
 * The top-of-dashboard panel: am I checked in, where, for how much longer — and
 * the one button that ends it.
 *
 * Server-rendered. The button is a `<form action={clearPresence}>`, so the only
 * JavaScript this page ships for it is `CheckOutButton`'s pending state; the
 * Supabase client stays on the server. See `dashboard/actions.ts` for what that
 * was worth in bytes.
 *
 * THE FOUR STATES ARE FOUR STATES
 * ---------------------------------------------------------------------------
 * `signed-out` and `unavailable` deliberately do not say "you are not checked
 * in". Neither one measured that: one means we cannot see this member's rows at
 * all, the other means the read failed. A commuter who reads a fabricated "you
 * are clear" and walks away is acting on a claim this component invented, and
 * the whole value of the panel is that it is the screen they trust before
 * leaving a curb.
 */
export default function CheckInStatusPanel({ presence, checkoutFailed }: CheckInStatusPanelProps) {
  return (
    <section aria-labelledby="check-in-status-heading" className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="check-in-status-heading" className="text-sm font-bold uppercase tracking-wide text-sky-700">
            Your check-in
          </h2>
          <PresenceSummary presence={presence} />
        </div>

        {presence.state === 'checked-in' && (
          <form action={clearPresence}>
            <CheckOutButton />
          </form>
        )}
      </div>

      {checkoutFailed && presence.state === 'checked-in' && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Check-out did not go through. You are still checked in — try again.
        </p>
      )}
    </section>
  )
}

function PresenceSummary({ presence }: { presence: MemberPresence }) {
  if (presence.state === 'signed-out') {
    return (
      <div className="mt-2">
        <p className="font-bold text-slate-950">You are signed out, so your check-in is not visible here.</p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-700">
          Check-ins are private to the member who made them. Member sign-in arrives with the accounts
          surface; the board below reads the public aggregates and needs no account.
        </p>
        <Link
          href="/how-it-works"
          className="mt-2 inline-block text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
        >
          How checking in works
        </Link>
      </div>
    )
  }

  if (presence.state === 'unavailable') {
    return (
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
        Your check-in status could not be read just now, so this panel is not saying whether you are
        checked in. Reload in a moment; the board below is unaffected.
      </p>
    )
  }

  if (presence.state === 'none') {
    return (
      <div className="mt-2">
        <p className="font-bold text-slate-950">You are not checked in anywhere.</p>
        <p className="mt-1 text-sm text-slate-700">
          Open a spot to check in — drivers see the count, not who you are.
        </p>
        <Link
          href="/spots"
          className="mt-2 inline-block text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
        >
          Browse spots
        </Link>
      </div>
    )
  }

  const direction = presenceDirectionLabel(presence.direction)

  return (
    <div className="mt-2">
      <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-950">
        <MapPin aria-hidden className="h-5 w-5 text-sky-700" />
        {presence.spotName ? (
          presence.routeSlug ? (
            <Link
              href={`/spots/${presence.routeSlug}`}
              className="text-sky-800 underline-offset-2 hover:underline"
            >
              {presence.spotName}
            </Link>
          ) : (
            presence.spotName
          )
        ) : (
          'Checked in — spot record not resolved'
        )}
        {direction && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
            {direction}
          </span>
        )}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {presence.checkedInAt && <>Checked in {formatRelativeTime(presence.checkedInAt)}. </>}
        {typeof presence.minutesRemaining === 'number' && (
          <>
            Expires in {presence.minutesRemaining} {presence.minutesRemaining === 1 ? 'minute' : 'minutes'} unless
            you check in again.
          </>
        )}
      </p>

      {!presence.spotName && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
          The spot directory record for this check-in is not readable in this environment, so it is not
          named. Checking out still clears it.
        </p>
      )}
    </div>
  )
}
