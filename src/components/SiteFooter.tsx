import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Link className="text-xl font-black tracking-tight text-white" href="/">Sluglines</Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            A practical information resource for Northern Virginia&apos;s informal carpool community.
          </p>
          <p className="mt-4 text-sm text-amber-200">Information changes. Confirm signs and conditions at the location before traveling.</p>
        </div>
        <nav aria-label="Explore">
          <h2 className="font-bold text-white">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/locations">Locations</Link></li>
            <li><Link className="hover:text-white" href="/advisories">Advisories</Link></li>
            <li><Link className="hover:text-white" href="/how-it-works">How it works</Link></li>
            <li><Link className="hover:text-white" href="/community">Community resources</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account and feedback">
          <h2 className="font-bold text-white">Your Sluglines</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/auth/sign-in">Sign in</Link></li>
            <li><Link className="hover:text-white" href="/account">Account</Link></li>
            <li><Link className="hover:text-white" href="/report">Report a correction</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-800 px-5 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Sluglines. Community information, independently presented.
      </div>
    </footer>
  )
}
