import Link from 'next/link'

import { LocationSearch } from '@/components/LocationSearch'
import { RouteHero } from '@/components/RouteHero'

const steps = [
  {
    number: '01',
    title: 'Choose a destination',
    detail: 'Use the location directory to find a pickup area that lists your intended destination.',
  },
  {
    number: '02',
    title: 'Confirm the line',
    detail: 'At the location, follow posted signs and confirm the destination with the driver before boarding.',
  },
  {
    number: '03',
    title: 'Travel thoughtfully',
    detail: 'Use established etiquette, trust your judgment, and choose another trip whenever something feels wrong.',
  },
]

export default function HomePage() {
  return (
    <>
      <RouteHero />

      <section aria-labelledby="find-heading" className="bg-slate-100">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Start with a route</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950" id="find-heading">Browse locations</h2>
            <p className="mt-3 leading-7 text-slate-600">Search by pickup area, corridor, or common destination. Review the source and freshness label before relying on a listing.</p>
          </div>
          <div className="mt-7"><LocationSearch /></div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">A quick orientation</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl" id="steps-heading">How an informal carpool trip comes together</h2>
          <p className="mt-4 leading-7 text-slate-600">Slugging is community-organized transportation, not a dispatched ride service. Conditions and line practices can change.</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <li className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={step.number}>
              <span className="text-sm font-black tracking-widest text-blue-700">{step.number}</span>
              <h3 className="mt-3 text-xl font-bold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </li>
          ))}
        </ol>
        <Link className="mt-8 inline-flex font-bold text-blue-700 underline-offset-4 hover:underline" href="/how-it-works">Read the complete beginner&apos;s guide</Link>
      </section>

      <section className="bg-cyan-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-800">Useful, honest information</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">See what is known—and what still needs review.</h2>
            <p className="mt-4 leading-7 text-slate-700">Location details include provenance and review status. A “needs review” label is an invitation to confirm locally, not a promise that the line is operating.</p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-6">
            <h3 className="font-bold text-slate-950">Help improve the directory</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">If a pickup point, destination, or operating note has changed, send a correction for review.</p>
            <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 font-bold text-white hover:bg-slate-800" href="/report">Report a correction</Link>
          </div>
        </div>
      </section>
    </>
  )
}
