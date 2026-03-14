'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Menu, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/spots', label: 'Slug Pickup' },
  { href: '/app', label: 'App' },
  { href: '/dashboard', label: 'Live Board' },
  { href: '/how-it-works', label: 'How It Works' },
  ]

const aboutLinks = [
  { href: '/about-slugging', label: 'About Slugging' },
  { href: '/about-us', label: 'About Us' },
  { href: '/slugging-rules', label: 'Rules & Etiquette' },
  ]

export default function Navbar() {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)
    const [aboutOpen, setAboutOpen] = useState(false)

  return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
              <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                      <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
                                <div className="bg-blue-600 text-white rounded-lg p-1.5">
                                            <Car className="w-5 h-5" />
                                </div>div>
                                Sluglines
                      </Link>Link>
              
                {/* Desktop Nav */}
                      <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                      <Link
                                      key={link.href}
                                      href={link.href}
                                      className={clsx(
                                                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                                        pathname === link.href
                                                          ? 'bg-blue-50 text-blue-600'
                                                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                      )}
                                    >
                        {link.label}
                      </Link>Link>
                    ))}
                      
                        {/* About Dropdown */}
                                <div className="relative" onMouseEnter={() => setAboutOpen(true)} onMouseLeave={() => setAboutOpen(false)}>
                                            <button
                                                            className={clsx(
                                                                              'flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                                                              aboutLinks.some(l => l.href === pathname)
                                                                                ? 'bg-blue-50 text-blue-600'
                                                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                                            )}
                                                          >
                                                          About
                                                          <ChevronDown className="w-4 h-4" />
                                            </button>button>
                                  {aboutOpen && (
                        <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-48 z-50">
                          {aboutLinks.map((link) => (
                                            <Link
                                                                  key={link.href}
                                                                  href={link.href}
                                                                                  className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                                                >
                                              {link.label}
                                            </Link>Link>
                                          ))}
                        </div>div>
                                            )}
                                </div>div>
                      </div>div>
              
                {/* Mobile Menu Toggle */}
                      <button
                                  className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                  onClick={() => setMenuOpen(!menuOpen)}
                                >
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                      </button>button>
              </div>div>
        
          {/* Mobile Menu */}
          {menuOpen && (
                  <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
                    {navLinks.map((link) => (
                                <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setMenuOpen(false)}
                                                className={clsx(
                                                                  'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                                                  pathname === link.href
                                                                    ? 'bg-blue-50 text-blue-600'
                                                                    : 'text-slate-600 hover:bg-slate-50'
                                                                )}
                                              >
                                  {link.label}
                                </Link>Link>
                              ))}
                            <div className="pt-1 border-t border-slate-100">
                                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">About</div>div>
                              {aboutLinks.map((link) => (
                                  <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    onClick={() => setMenuOpen(false)}
                                                    className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                                                  >
                                    {link.label}
                                  </Link>Link>
                                ))}
                            </div>div>
                  </div>div>
              )}
        </nav>nav>
      )
}</nav>
