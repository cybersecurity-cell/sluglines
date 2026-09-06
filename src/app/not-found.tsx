import Link from 'next/link'
import { GONE_TOKENS } from '@/lib/gone-page'

/**
 * The 404 — the App Router's `not-found.tsx`, rendered by every `notFound()`
 * call in `src/app/**` and for any path no route matches. Issue #134.
 *
 * Before this file existed the default Next 404 rendered onto the legacy dark
 * `:root` shell (`globals.css`), the same 1.04:1 grid `/board` painted. It is
 * modelled on the branded 410 (`src/lib/gone-page.ts`): a wordmark, one
 * sentence, and the two links rev. 5.3 §8 M1 names for a dead end — `/spots`
 * and `/lostfound`. The colours are the 410's own `GONE_TOKENS`, whose every
 * foreground/background pair `tests/legacy-redirects.test.mjs` already holds
 * to WCAG AA, so this page inherits a tested palette instead of a new one.
 *
 * Unlike the 410 this is a normal page: it renders inside the root layout
 * (nav and footer) and Next sets the 404 status itself.
 */
export const metadata = {
  title: 'Page not found - Sluglines',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="min-h-[60vh]" style={{ background: GONE_TOKENS.ground, color: GONE_TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GONE_TOKENS.accent }}>
          Sluglines
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">That page isn&apos;t here</h1>
        <p className="mt-4 text-base leading-7" style={{ color: GONE_TOKENS.inkMuted }}>
          The address may be mistyped, or the page may have moved when the site was rebuilt. The two
          things most people are looking for are below.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/spots"
            className="inline-flex min-h-[44px] items-center rounded-lg px-5 py-3 text-sm font-bold"
            style={{ background: GONE_TOKENS.accent, color: GONE_TOKENS.accentInk }}
          >
            Slug pickup locations
          </Link>
          <Link
            href="/lostfound"
            className="inline-flex min-h-[44px] items-center rounded-lg border px-5 py-3 text-sm font-bold"
            style={{ borderColor: GONE_TOKENS.rule, color: GONE_TOKENS.accent }}
          >
            Lost &amp; Found board
          </Link>
        </div>
      </div>
    </div>
  )
}
