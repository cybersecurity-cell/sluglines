import Link from 'next/link'

const navLinks = [
  { href: '/locations', label: 'Locations' },
  { href: '/advisories', label: 'Advisories' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/community', label: 'Community' },
]

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {navLinks.map((link) => (
        <Link className={mobile ? 'block rounded-lg px-3 py-3 font-semibold text-slate-700 hover:bg-slate-100' : 'rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950'} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </>
  )
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link className="rounded-sm text-xl font-black tracking-tight text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href="/">
          Sluglines
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <NavigationLinks />
          <Link className="ml-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100" href="/auth/sign-in">Sign in</Link>
          <Link className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800" href="/find">Find a line</Link>
        </nav>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-900 marker:content-none">Menu</summary>
          <nav aria-label="Mobile primary" className="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <NavigationLinks mobile />
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <Link className="rounded-xl border border-slate-300 px-3 py-3 text-center font-bold text-slate-900" href="/auth/sign-in">Sign in</Link>
              <Link className="rounded-xl bg-blue-700 px-3 py-3 text-center font-bold text-white" href="/find">Find a line</Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  )
}
