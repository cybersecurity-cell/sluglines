'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ABOUT_NAV, PRIMARY_NAV } from '@/lib/site-content'

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutRef = useRef<HTMLDivElement>(null)

  // Issue #141: the About menu opened on hover only, so a keyboard user could
  // never reach About Slugging / About Us from the nav. It now toggles on
  // click, Enter, Space and ArrowDown, and Escape closes it and the mobile
  // sheet; focus leaving the menu closes it too.
  useEffect(() => {
    if (!aboutOpen && !menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAboutOpen(false)
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [aboutOpen, menuOpen])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  // §10 tokens, shared by the desktop row and the mobile sheet so the two cannot
  // drift. The active state is a green tint plus a darker green label — colour
  // AND weight, never colour alone (WCAG 1.4.1) — and `min-h-[44px]` is the §10
  // tap target, which the old `py-2`/`py-2.5` pills (36px and 40px) missed.
  const itemBase = 'rounded-md px-3 text-sm font-semibold transition-colors inline-flex items-center min-h-[44px]'
  const itemActive = 'bg-[#EAF2ED] text-[#1F5C33]'
  const itemIdle = 'text-slate-600 hover:bg-stone-100 hover:text-[#17202A]'

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" onClick={() => setMenuOpen(false)}>
          <span className="h-display text-xl text-[#17202A]">Sluglines</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={clsx(itemBase, isActive(link.href) ? itemActive : itemIdle)}
            >
              {link.label}
            </Link>
          ))}

          <div
            ref={aboutRef}
            className="relative"
            onMouseEnter={() => setAboutOpen(true)}
            onMouseLeave={() => setAboutOpen(false)}
            onBlur={(event) => {
              if (!aboutRef.current?.contains(event.relatedTarget as Node | null)) setAboutOpen(false)
            }}
          >
            <button
              className={clsx(
                itemBase,
                'gap-1',
                ABOUT_NAV.some((link) => isActive(link.href)) ? itemActive : itemIdle
              )}
              type="button"
              aria-haspopup="menu"
              aria-controls="about-menu"
              aria-expanded={aboutOpen}
              onClick={() => setAboutOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setAboutOpen(true)
                }
              }}
            >
              About
              <ChevronDown aria-hidden className="h-3.5 w-3.5" />
            </button>
            {aboutOpen && (
              <div
                id="about-menu"
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border border-stone-200 bg-white py-1 shadow-xl"
              >
                {ABOUT_NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setAboutOpen(false)}
                    className="flex min-h-[44px] items-center px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-[#FAFAF8] hover:text-[#17202A]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-stone-100 hover:text-[#17202A] md:hidden"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-3 md:hidden">
          <div className="space-y-1">
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={clsx(itemBase, 'w-full', isActive(link.href) ? itemActive : itemIdle)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 border-t border-stone-200 pt-3">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">About</div>
            {ABOUT_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={clsx(itemBase, 'w-full', itemIdle)}
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
