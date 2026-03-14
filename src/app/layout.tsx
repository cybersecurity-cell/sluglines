import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Sluglines — Connecting drivers and riders for better commute',
    description: 'Sluglines connects Northern Virginia commuters for HOV-3 carpools. Find a driver or rider at your nearest slug line spot. Real-time wait counts for I-95, I-395, and I-66 commuters.',
    keywords: 'slug lines, slugging, HOV-3, carpool, Northern Virginia, commute, I-95, I-395, I-66, Pentagon, Crystal City',
    openGraph: {
          title: 'Sluglines — Connecting drivers and riders for better commute',
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
                        </main>main>
                        <footer className="bg-slate-900 text-slate-300 py-12 mt-20">
                                  <div className="max-w-6xl mx-auto px-4">
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                                {/* Brand */}
                                                            <div>
                                                                            <h3 className="text-white font-bold text-lg mb-3">Sluglines</h3>h3>
                                                                            <p className="text-sm leading-relaxed mb-4">
                                                                                              Connecting drivers and riders for better commute in Northern Virginia since 2015.
                                                                            </p>p>
                                                                            <p className="text-xs text-slate-400">Email: admin@sluglines.com</p>p>
                                                            </div>div>
                                              
                                                {/* Quick Links */}
                                                            <div>
                                                                            <h4 className="text-white font-semibold mb-3">Quick Links</h4>h4>
                                                                            <ul className="space-y-2 text-sm">
                                                                                              <li><Link href="/spots" className="hover:text-white transition-colors">Slug Pickup Locations</Link>Link></li>li>
                                                                                              <li><Link href="/app" className="hover:text-white transition-colors">Mobile App</Link>Link></li>li>
                                                                                              <li><Link href="/dashboard" className="hover:text-white transition-colors">Live Board</Link>Link></li>li>
                                                                                              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>Link></li>li>
                              <li><Link href="/slugging-rules" className="hover:text-white transition-colors">Slugging Rules & Etiquette</Link>Link></li>li>
                                                                            </ul>ul>
                                                            </div>div>
                                              
                                                {/* About */}
                                                            <div>
                                                                            <h4 className="text-white font-semibold mb-3">About Sluglines</h4>h4>
                                                                            <ul className="space-y-2 text-sm">
                                                                                              <li><Link href="/about-us" className="hover:text-white transition-colors">About Us</Link>Link></li>li>
                                                                                              <li><Link href="/about-slugging" className="hover:text-white transition-colors">About Slugging</Link>Link></li>li>
                                                                                              <li><Link href="/slugging-rules" className="hover:text-white transition-colors">Rules & Etiquette</Link>Link></li>li>
                                                                                              <li><Link href="/app" className="hover:text-white transition-colors">Mobile App</Link>Link></li>li>
                                                                            </ul>ul>
                                                            </div>div>
                                              
                                                {/* Social Media */}
                                                            <div>
                                                                            <h4 className="text-white font-semibold mb-3">Social Media</h4>h4>
                                                                            <ul className="space-y-2 text-sm">
                                                                                              <li>
                                                                                                                  <a href="http://facebook.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                                                                                                                        <span className="w-4 h-4 text-blue-400">f</span>span> Facebook
                                                                                                                    </a>a>
                                                                                                </li>li>
                                                                                              <li>
                                                                                                                  <a href="https://twitter.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                                                                                                                        <span className="w-4 h-4 text-sky-400">t</span>span> Twitter / X
                                                                                                                    </a>a>
                                                                                                </li>li>
                                                                                              <li>
                                                                                                                  <a href="https://www.youtube.com/sluglines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                                                                                                                                        <span className="w-4 h-4 text-red-400">▶</span>span> YouTube
                                                                                                                    </a>a>
                                                                                                </li>li>
                                                                            </ul>ul>
                                                                            <div className="mt-4 text-sm">
                                                                                              <h5 className="text-white font-medium mb-2">Facebook Groups</h5>h5>
                                                                                              <ul className="space-y-1 text-xs text-slate-400">
                                                                                                                  <li><a href="https://www.facebook.com/groups/springfieldsluglines/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Springfield Slug Lines</a>a></li>li>
                                                                                                                  <li><a href="https://www.facebook.com/groups/woodbridgesluglines/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Woodbridge Slug Lines</a>a></li>li>
                                                                                                                  <li><a href="https://www.facebook.com/groups/StaffordSluglines/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Stafford Slug Lines</a>a></li>li>
                                                                                                                  <li><a href="https://www.facebook.com/groups/I66Sluglines/" target="_blank" rel="noopener noreferrer" className="hover:text-white">I-66 Slug Lines</a>a></li>li>
                                                                                                                  <li><a href="https://www.facebook.com/groups/dcsluglines/" target="_blan</html>
