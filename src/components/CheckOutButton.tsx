'use client'

import { useFormStatus } from 'react-dom'
import { LogOut } from 'lucide-react'

/**
 * The submit button for the checkout form, and the only client component on the
 * dashboard.
 *
 * It exists solely so the tap has feedback: `useFormStatus` reports the pending
 * state of the enclosing `<form>`, which on a commuter-lot connection is the
 * difference between "it worked" and a second tap. Everything else about the
 * checkout — the call, the failure, the re-render — is server-side, and the form
 * still submits if this component never hydrates.
 *
 * No confirmation step, deliberately. Checking out is cheap and reversible;
 * the failure it prevents — a member who has driven off still showing as waiting
 * at a curb — costs a driver a detour. A modal in front of that correction is
 * the wrong trade.
 */
export default function CheckOutButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
    >
      <LogOut aria-hidden className="h-4 w-4" />
      {pending ? 'Checking out…' : 'Check out'}
    </button>
  )
}
