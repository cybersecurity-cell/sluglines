'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { ABOUT_NAV, PRIMARY_NAV } from '@/lib/site-content'

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="rounded-md bg-sky-700 px-2 py-1 text-sm font-extrabold text-white">SL</span>
          <span className="text-xl font-extrabold tracking-tight text-slate-950">Sluglines</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                isActive(link.href)
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              {link.label}
            </Link>
          ))}

          <div className="relative" onMouseEnter={() => setAboutOpen(true)} onMouseLeave={() => setAboutOpen(false)}>
            <button
              className={clsx(
                'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                ABOUT_NAV.some((link) => isActive(link.href))
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
              type="button"
            >
              About
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {aboutOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                {ABOUT_NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 md:hidden"
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="space-y-1">
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  'block rounded-md px-4 py-2.5 text-sm font-semibold transition-colors',
                  isActive(link.href)
                    ? 'bg-sky-50 text-sky-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">About</div>
            {ABOUT_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
