'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Menu, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/spots', label: 'Slug Pickup' },
  { href: '/dashboard', label: 'Live Board' },
  { href: '/app', label: 'App' },
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
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ background: 'rgba(8,13,23,0.85)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Car className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-white" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>Sluglines</span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={clsx('px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150', pathname===link.href?'text-white bg-white/10':'text-slate-400 hover:text-white hover:bg-white/6')}>{link.label}</Link>
          ))}
          <div className="relative" onMouseEnter={()=>setAboutOpen(true)} onMouseLeave={()=>setAboutOpen(false)}>
            <button className={clsx('flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all', aboutLinks.some(l => l.href===pathname)?'text-white bg-white/10':'text-slate-400 hover:text-white hover:bg-white/6')}>About<ChevronDown className="w-3.5 h-3.5 opacity-60" /></button>
            {aboutOpen && (<div className="absolute top-full left-0 mt-1 rounded-xl shadow-xl py-1 min-w-44 border z-50" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>{aboutLinks.map(link => (<Link key={link.href} href={link.href} className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">{link.label}</Link>))}</div>)}
          </div>
          <Link href="/dashboard" className="ml-2 flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-sky-500/20"><span className="live-dot"></span>Live Board</Link>
        </div>
        <button className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-colors" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X className="w-5 h-5" />:<Menu className="w-5 h-5" />}</button>
      </div>
      {menuOpen && (<div className="md:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: 'var(--border)' }}>{navLinks.map(link => (<Link href={link.href} key={link.href} onClick={()=>setMenuOpen(false)} className={clsx('block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors', pathname===link.href?'text-white bg-white/10':'text-slate-400 hover:text-white hover:bg-white/6')}>{link.label}</Link>))}<div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}><div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">About</div>{aboutLinks.map(link => (<Link key={link.href} href={link.href} onClick={()=>setMenuOpen(false)} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/6 transition-colors">{link.label}</Link>))}</div></div>)}
    </nav>
  )
}
