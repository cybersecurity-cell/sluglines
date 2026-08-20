import Link from 'next/link'

export function RouteHero() {
  return (
    <section className="relative isolate overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="route-grid absolute inset-0 opacity-35" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Northern Virginia commuter guide</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Plan your slugging commute with clearer information.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Browse pickup locations, common destinations, advisories, and community resources. Every operational detail shows its source and review status.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-6 font-bold text-slate-950 hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" href="/find">
              Find a line
            </Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-600 px-6 font-bold text-white hover:border-slate-400 hover:bg-slate-900" href="/how-it-works">
              Learn how slugging works
            </Link>
          </div>
        </div>
        <div aria-label="A simple route illustration connecting pickup, HOV corridor, and destination" className="route-map rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl" role="img">
          <ol className="space-y-5">
            <li className="flex items-center gap-4"><span className="route-node bg-emerald-400">1</span><span><strong className="block">Pickup location</strong><span className="text-sm text-slate-400">Join the line for your destination</span></span></li>
            <li className="flex items-center gap-4"><span className="route-node bg-cyan-400 text-slate-950">2</span><span><strong className="block">Shared HOV trip</strong><span className="text-sm text-slate-400">Confirm the destination before boarding</span></span></li>
            <li className="flex items-center gap-4"><span className="route-node bg-violet-400 text-slate-950">3</span><span><strong className="block">Drop-off area</strong><span className="text-sm text-slate-400">Use the agreed established stop</span></span></li>
          </ol>
        </div>
      </div>
    </section>
  )
}
