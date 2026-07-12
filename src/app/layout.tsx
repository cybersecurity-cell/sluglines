import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

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
    <html lang="en">
      <body>
        <Navbar />
        <main className="min-h-screen relative z-10">
          {children}
        </main>
        <footer className="relative z-10 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-4 py-14">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              <div className="md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>S</div>
                  <span className="font-bold text-lg text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Sluglines</span>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>Connecting drivers and riders for better commute</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>admin@sluglines.com</p>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Quick Links</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><a href="/forum/viewforum.php?f=4" className="hover:text-white transition-colors">Lost &amp; Found</a></li>
                  <li><Link href="/metroshutdown-2019" className="hover:text-white transition-colors">Metro Shutdown 2019</Link></li>
                  <li><Link href="/slugging-rules-and-etiquette" className="hover:text-white transition-colors">Slugging Rules and Etiquette</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>About Sluglines</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><Link href="/slug_pickup" className="hover:text-white transition-colors">SLUG PICKUP</Link></li>
                  <li><Link href="/app" className="hover:text-white transition-colors">APP</Link></li>
                  <li><Link href="/forum" className="hover:text-white transition-colors">FORUM</Link></li>
                  <li><Link href="/blog" className="hover:text-white transition-colors">BLOG</Link></li>
                  <li><Link href="/news" className="hover:text-white transition-colors">NEWS</Link></li>
                  <li><a href="/wp-login.php" className="hover:text-white transition-colors">LOGIN</a></li>
                  <li><a href="/wp-login.php?action=register" className="hover:text-white transition-colors">REGISTER</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Search</h4>
                <form action="/" className="mb-6 flex gap-2">
                  <label className="sr-only" htmlFor="footer-search">Search for:</label>
                  <input
                    id="footer-search"
                    name="s"
                    type="search"
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <button className="rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white" type="submit">
                    Search
                  </button>
                </form>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Social media</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><a href="http://facebook.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Facebook</a></li>
                  <li><a href="https://twitter.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter / X</a></li>
                  <li><a href="https://www.youtube.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a></li>
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
