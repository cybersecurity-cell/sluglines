import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'How slugging works | Sluglines', description: 'A plain-language introduction to Northern Virginia informal carpool lines.' }

const steps = [
  ['Find a pickup location', 'Use the directory as a starting point, then confirm current signs and where the queue is forming.'],
  ['Listen for the destination', 'Drivers identify where they are going. Line practices vary, so observe the people and signs at that location.'],
  ['Confirm the destination', 'Before entering a vehicle, repeat the destination and expected drop-off point. Decline if the trip is not right for you.'],
  ['Buckle up and travel', 'Wear a seat belt, respect the vehicle, and follow the same personal-safety judgment you would use for any shared trip.'],
]

export default function HowItWorksPage() {
  return <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Beginner&apos;s guide</p><h1 className="mt-2 text-4xl font-black tracking-tight">How slugging works</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">Slugging is an informal carpool practice: people gather at known pickup areas and share trips with drivers heading toward a common destination. It is not dispatched or supervised by this website.</p><ol className="mt-10 grid gap-5 md:grid-cols-2">{steps.map(([title, detail], index) => <li className="rounded-2xl border border-slate-200 bg-white p-6" key={title}><span className="text-sm font-black text-blue-700">0{index + 1}</span><h2 className="mt-2 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></li>)}</ol><section className="mt-12 rounded-2xl bg-slate-100 p-6"><h2 className="text-xl font-black">What this directory can—and cannot—tell you</h2><p className="mt-3 text-sm leading-6 text-slate-700">Listings summarize known pickup areas, connections, and sources. They do not guarantee that a line is operating, that a vehicle or participant is safe, or that a particular occupancy rule applies at the time you travel. Check current road signs and official transportation guidance.</p></section><div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white" href="/locations">Browse locations</Link><Link className="rounded-xl border border-slate-300 px-5 py-3 font-bold" href="/slugging-rules">Read safety and etiquette guidance</Link></div></div>
}
