'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * The App Router error boundary for every route under `src/app/` (issue
 * #136). Before this file existed an unhandled render error — `/dashboard`
 * constructing a Supabase client with no environment, for one — fell to
 * Next's default 500: a bare document with no `<title>`, which axe reports as
 * serious, painted onto the dark `:root` shell.
 *
 * This renders inside the root layout (so `lang`, the nav and the footer are
 * kept) with the same light ground the authenticated surfaces paint. It says
 * the fault is ours, offers the one thing a boundary can do (`reset()`
 * re-renders the segment) and a way out, and reports the error to the
 * console so it reaches Vercel's runtime logs. It never shows `error.message`:
 * that text is written for an operator and can name internals.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="bg-white text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Error</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">This page hit a problem on our end</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          Nothing you did caused it, and nothing you posted or reserved was lost. You can try the page again,
          or go back to the spots directory, which needs no account.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-500">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            Try again
          </button>
          <Link
            href="/spots"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-50"
          >
            Slug pickup locations
          </Link>
        </div>
      </div>
    </div>
  )
}
