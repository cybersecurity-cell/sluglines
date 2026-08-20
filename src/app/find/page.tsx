import type { Metadata } from 'next'

import { LocationSearch } from '@/components/LocationSearch'

export const metadata: Metadata = {
  title: 'Find a slug line | Sluglines',
  description: 'Search Northern Virginia slugging pickup locations by area, corridor, direction, or destination.',
}

export default function FindPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Location finder</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Find a line that fits your commute</h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">Start with a pickup area or destination. Results show the known source and review status so you can judge how current each listing may be.</p>
      <div className="mt-8"><LocationSearch /></div>
      <aside className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <strong>Before you travel:</strong> community lines can move or pause. Check current signs and local conditions, particularly when a listing needs review.
      </aside>
    </div>
  )
}
