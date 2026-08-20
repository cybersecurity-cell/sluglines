import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import Navbar from '@/components/Navbar'
import { SiteFooter } from '@/components/SiteFooter'

import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://sluglines.com'),
  title: 'Sluglines | Northern Virginia carpool information',
  description: 'Find sourced pickup-location, destination, advisory, safety, and etiquette information for Northern Virginia slugging commuters.',
  applicationName: 'Sluglines',
  openGraph: {
    title: 'Sluglines | Northern Virginia carpool information',
    description: 'A practical, source-labelled guide to Northern Virginia slugging locations and community resources.',
    url: '/',
    siteName: 'Sluglines',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-950 antialiased">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Navbar />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
