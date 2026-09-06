import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit, Syne } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

// Self-hosted through next/font rather than the `@import url(fonts.googleapis.com)`
// that used to sit at the top of globals.css. That import is render-blocking and
// serialises HTML -> CSS -> font CSS -> font files against a third-party origin;
// it was the largest single contributor to the homepage LCP, which the issue #20
// budget (< 2.0s) failed on its first run at 2026 ms. next/font inlines the
// @font-face rules and preloads the files from our own origin.
//
// `display: 'optional'`, not 'swap', and that is the whole LCP fix. With 'swap'
// the measured LCP element -- a paragraph -- painted in the fallback at FCP 0.9s
// and then REPAINTED when the web font arrived, and Lighthouse records the later
// paint: 2.6s against a 2.0s budget while every other metric was excellent
// (FCP 0.9s, Speed Index 1.0s, TBT 30ms). 'optional' gives the font ~100ms to
// arrive and otherwise keeps the fallback for that page load, so there is no late
// repaint. For a commuter opening this on a lot cell signal, text readable
// immediately in a system font beats the right typeface arriving two seconds in.
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'optional', variable: '--font-syne' })
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600'], display: 'optional', variable: '--font-outfit' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'optional', variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Sluglines - HOV-3 Carpool for Northern Virginia',
  description: 'Real-time driver and rider matching for Northern Virginia HOV-3 commuters on I-95, I-395, and I-66.',
  keywords: 'slug lines, slugging, HOV-3, carpool, Northern Virginia, commute, I-95, I-395, I-66, Pentagon',
  openGraph: {
    title: 'Sluglines - HOV-3 Carpool for Northern Virginia',
    description: 'Real-time driver and rider matching for Northern Virginia HOV-3 commuters.',
    url: 'https://sluglines.com',
    siteName: 'Sluglines',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${syne.variable} ${outfit.variable} ${mono.variable}`}>
      <body>
        {/* Issue #141: a skip link, visible on focus, ahead of the nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[#2E7D46] focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <header>
          <Navbar />
        </header>
        <main id="main" className="min-h-screen relative z-10">
          {children}
        </main>
        <footer className="relative z-10 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-4 py-14">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              <div className="md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-bold text-lg text-white" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>Sluglines</span>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>Connecting drivers and riders for better commute</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  <a href="mailto:admin@sluglines.com" className="hover:text-white transition-colors">admin@sluglines.com</a>
                </p>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>Quick Links</h2>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><Link href="/lostfound" className="inline-block py-1.5 hover:text-white transition-colors">Lost &amp; Found</Link></li>
                  <li><Link href="/slugging-rules-and-etiquette" className="inline-block py-1.5 hover:text-white transition-colors">Slugging Rules and Etiquette</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>About Sluglines</h2>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><Link href="/slug_pickup" className="inline-block py-1.5 hover:text-white transition-colors">SLUG PICKUP</Link></li>
                  <li><Link href="/app" className="inline-block py-1.5 hover:text-white transition-colors">APP</Link></li>
                  <li><Link href="/blog" className="inline-block py-1.5 hover:text-white transition-colors">BLOG</Link></li>
                  <li><Link href="/news" className="inline-block py-1.5 hover:text-white transition-colors">NEWS</Link></li>
                  <li><Link href="/login" className="inline-block py-1.5 hover:text-white transition-colors">SIGN IN</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>Find a spot</h2>
                {/*
                  This used to be a `<form action="/" name="s">` left over from
                  the WordPress theme; `/?s=x` returns 200 and ignores the query
                  entirely. `/spots` runs the real filter
                  (`src/lib/spot-search.ts`), so this links there instead of
                  re-implementing a second, working search box. The §10 accent
                  (`#2E7D46`, white on it is 5.07:1) and the 44px tap target
                  carry over from the control this replaced.
                */}
                <Link
                  href="/spots"
                  className="mb-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#2E7D46] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#245F37]"
                >
                  Search pickup locations
                </Link>
                <h2 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>Social media</h2>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><a href="http://facebook.com/sluglines" target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-white transition-colors">Facebook</a></li>
                  <li><a href="https://twitter.com/sluglines" target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-white transition-colors">Twitter / X</a></li>
                  <li><a href="https://www.youtube.com/sluglines" target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-white transition-colors">YouTube</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>(c) Sluglines {new Date().getFullYear()}.</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Serving Northern Virginia commuters on I-95, I-395, and I-66</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
