'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Updated 6:42 AM EDT" plus a bounded poll (issue #140). Nothing in `src/`
 * had any refresh but the viewer's own action, so a rider watching the board
 * at the curb saw a stale list until they did something. Realtime is the
 * eventual answer (rev. 5.3 §8 M3); until it is wired, this re-renders the
 * server board every `intervalMs` while the tab is visible, and stops when it
 * is hidden — a phone in a pocket should not poll.
 *
 * The label is the server's render time, formatted by the page in the board's
 * zone (`BOARD_TIME_ZONE`) and passed in as text — a clock the reader can
 * compare with their own, not "just now" that is never true, and no client
 * state to hydrate.
 */
export default function LiveUpdated({ renderedLabel, intervalMs = 30_000 }: { renderedLabel: string; intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router, intervalMs])

  return (
    <p className="text-xs text-slate-500" aria-live="polite">
      Updated {renderedLabel} · refreshes every {Math.round(intervalMs / 1000)}s while open
    </p>
  )
}
