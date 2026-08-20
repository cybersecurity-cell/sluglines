import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Safety and etiquette | Sluglines', description: 'Personal-safety boundaries and courteous practices for informal carpool trips.' }

const riderGuidance = ['Confirm the destination and expected drop-off before boarding.', 'You can decline any ride for any reason. You do not owe an explanation.', 'Wear a seat belt and keep emergency contacts accessible.', 'Respect the driver’s vehicle and ask before changing windows, audio, or temperature.']
const driverGuidance = ['State the destination and intended drop-off clearly.', 'Keep the vehicle roadworthy and make seat belts available.', 'Follow current traffic, occupancy, and toll rules shown by official signs.', 'Respect a rider’s decision to decline or leave the trip.']

export default function SafetyPage() {
  return <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Personal judgment comes first</p><h1 className="mt-2 text-4xl font-black tracking-tight">Safety and etiquette</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">Informal carpools involve people and vehicles that Sluglines does not screen. These suggestions are general guidance, not a safety guarantee.</p><div className="mt-10 grid gap-6 md:grid-cols-2"><Guidance title="For riders" items={riderGuidance} /><Guidance title="For drivers" items={driverGuidance} /></div><section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950"><h2 className="text-xl font-black">If something feels wrong</h2><p className="mt-3 text-sm leading-6">Move to a public place, decline the trip, or ask to exit somewhere safe. For immediate danger or a medical emergency, call 911. Sluglines is an information website, not emergency services, transportation dispatch, or law enforcement.</p></section><section className="mt-8 rounded-2xl border border-slate-200 p-6"><h2 className="text-xl font-black">Courtesy is contextual</h2><p className="mt-3 text-sm leading-6 text-slate-600">Queue and conversation customs can differ by location. Observe posted guidance, communicate plainly, avoid sharing another person’s identifying details online, and never pressure someone to participate.</p></section></div>
}

function Guidance({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">{title}</h2><ul className="mt-4 space-y-3">{items.map((item) => <li className="flex gap-3 text-sm leading-6 text-slate-700" key={item}><span aria-hidden="true" className="font-black text-emerald-600">✓</span><span>{item}</span></li>)}</ul></section>
}
