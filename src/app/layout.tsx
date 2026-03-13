import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sluglines — HOV-3 Carpool Coordination | Northern Virginia',
  description: 'Coordinate HOV-3 carpools at slug lines spots in Northern Virginia. Real-time driver and rider matching for I-95, I-395, and I-66 commuters.',
  keywords: 'slug lines, HOV-3, carpool, Northern Virginia, commute, I-95, I-395, Pentagon',
  openGraph: {
    title: 'Sluglines — HOV-3 Carpool Coordination',
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
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <footer className="bg-slate-900 text-slate-300 py-12 mt-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-white font-bold text-lg mb-3">Sluglines</h3>
                <p className="text-sm leading-relaxed">
                  Helping Northern Virginia commuters leverage HOV-3 lanes for faster, cheaper commutes since 2015.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-3">Quick Links</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                  <li><a href="/spots" className="hover:text-white transition-colors">Pickup Spots</a></li>
                  <li><a href="/dashboard" className="hover:text-white transition-colors">Live Board</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-3">Download App</h4>
                <div className="flex flex-col gap-2">
                  <a href="#" className="text-sm hover:text-white transition-colors">iOS App Store</a>
                  <a href="#" className="text-sm hover:text-white transition-colors">Google Play Store</a>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-700 mt-8 pt-8 text-center text-sm">
              <p>&copy; {new Date().getFullYear()} Sluglines. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
