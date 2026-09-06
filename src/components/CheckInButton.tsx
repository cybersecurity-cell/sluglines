'use client'

import { useFormStatus } from 'react-dom'
import { MapPin } from 'lucide-react'

/**
 * The submit button for the spot page's check-in form — `CheckOutButton`'s
 * twin, and for the same reason: `useFormStatus` gives the tap feedback on a
 * commuter-lot connection, and everything else (the call, the outcome, the
 * re-render) is server-side in `app/spots/actions.ts`. The form still submits
 * if this never hydrates.
 *
 * §10 tokens: the spot page is a public, redesigned surface
 * (`tests/public-surface-tokens.test.mjs`), so this is the highway-green
 * primary, 44px tall, white on `#2E7D46` (5.07:1).
 */
export default function CheckInButton({ spotName }: { spotName: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#2E7D46] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#245F37] disabled:opacity-60"
    >
      <MapPin aria-hidden className="h-4 w-4" />
      {pending ? 'Checking in…' : `Check in at ${spotName}`}
    </button>
  )
}
