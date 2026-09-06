'use client'

import { useFormStatus } from 'react-dom'

/**
 * The submit button for `/board`'s cancel and release forms
 * (`app/board/actions.ts`) — `CheckOutButton`'s pattern: `useFormStatus` gives
 * the tap feedback on a lot cell signal, and everything else is server-side.
 * No confirmation step, for the same reason checkout has none: both actions
 * are the member undoing their own claim, and the failure they prevent — a
 * seat or an offer standing when its owner has gone — costs someone else a
 * detour.
 */
export default function BoardActionButton({
  label,
  pendingLabel,
  tone = 'secondary',
}: {
  label: string
  pendingLabel: string
  tone?: 'secondary' | 'danger'
}) {
  const { pending } = useFormStatus()
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-white text-red-800 hover:bg-red-50'
      : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-50'

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${toneClass}`}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}
