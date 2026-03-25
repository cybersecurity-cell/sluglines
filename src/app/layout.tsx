import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sluglines â HOV-3 Carpool for Northern Virginia',
  description: 'Real-time driver and rider matching for Northern Virginia HOV-3 commuters on I-95, I-395, and I-66.',
  keywords: 'slug lines, slugging, HOV-3, carpool, Northern Virginia, commute, I-95, I-395, I-66, Pentagon',
  openGraph: {
    title: 'Sluglines â HOV-3 Carpool for Northern Virginia',
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
                  <div className="w8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>S</div>
                  <span className="font-bold text-lg text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Sluglines</span>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
                  Connecting Northern Virginia commuters for HOV-3 carpools since 2015.
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>admin@sluglines.com</p>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Navigate</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><Link href="/spots" className="hover:text-white transition-colors">Pickup Locations</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Live Board</Link></li>
                  <li><Link href="/app" className="hover:text-white transition-colors">Mobile App</Link></li>
                  <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                  <li><Link href="/slugging-rules" className="hover:text-white transition-colors">Rules &amp; Etiquette</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>About</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><Link href="/about-slugging" className="hover:text-white transition-colors">About Slugging</Link></li>
                  <li><Link href="/about-us" className="hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="/slugging-rules" className="hover:text-white transition-colors">Slugging Etiquette</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Community</h4>
                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--muted)' }}>
                  <li><a href="http://facebook.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Facebook</a></li>
                  <li><a href="https://twitter.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter / X</a></li>
                  <li><a href="https://www.youtube.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Â© {new Date().getFullYear()} Sluglines. All rights reserved.</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Serving Northern Virginia commuters on I-95 Â· I-395 Â· I-66</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
