import { Car, Users, MapPin, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'How It Works — Sluglines',
  description: 'Learn how HOV-3 slug lines work in Northern Virginia.',
}

const FAQ = [
  {
    q: 'Is slugging safe?',
    a: 'Slugging has an excellent decades-long safety record. It happens in high-visibility public areas. There have been very few reported incidents over millions of rides.',
  },
  {
    q: 'Do I pay for the ride?',
    a: 'No money is ever exchanged. Both drivers and riders benefit equally — drivers get HOV-3 access, riders get a free ride to their destination.',
  },
  {
    q: 'Who calls the destination?',
    a: 'The rider announces their destination when the car pulls up. The driver accepts only if it is on their route. Common destinations: Pentagon, L'Enfant Plaza, 14th & New York, Rosslyn.',
  },
  {
    q: 'What are the etiquette rules?',
    a: 'Keep the ride quiet unless the driver initiates conversation. No smoking, strong scents, or eating. Have your phone or bag ready so you can board quickly.',
  },
  {
    q: 'What hours does slugging happen?',
    a: 'Primarily weekday rush hours: 6:00–9:30 AM inbound and 4:00–7:00 PM outbound. Volume depends on the spot and season.',
  },
  {
    q: 'Can I use the Sluglines app?',
    a: 'Yes! Download the Sluglines app on iOS or Android to see real-time wait counts, get spot directions, and set your commute preferences.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="text-center mb-14">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">How Slugging Works</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Slugging is Northern Virginia's informal HOV carpool system — a decades-old commuter tradition 
          that lets strangers share rides to use the express HOV-3 lanes.
        </p>
      </div>

      {/* For Riders */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-100 p-2 rounded-xl"><Users className="w-6 h-6 text-green-600" /></div>
          <h2 className="text-2xl font-bold text-slate-900">For Riders</h2>
        </div>
        <div className="space-y-4">
          {[
            { step: 1, title: 'Go to a slug line spot', desc: 'Head to one of the designated pickup spots near you. Use the Spots page to find the closest one.' },
            { step: 2, title: 'Form a line and wait', desc: 'Stand in the queue at the spot. The line is first-come, first-served. Spots are well-known — locals know where to wait.' },
            { step: 3, title: 'Call your destination', desc: 'When a car pulls up, the driver or a passenger asks "Where are you going?" — call out your destination clearly.' },
            { step: 4, title: 'Ride for free', desc: 'You get a free ride to your destination. No payment, no app required. Just hop in and enjoy the commute.' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-4 card">
              <div className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="text-slate-600 text-sm mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For Drivers */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-xl"><Car className="w-6 h-6 text-blue-600" /></div>
          <h2 className="text-2xl font-bold text-slate-900">For Drivers</h2>
        </div>
        <div className="space-y-4">
          {[
            { step: 1, title: 'Drive to a slug line spot', desc: 'Approach the designated slug line pickup area. Signs or painted curbs often mark the spot.' },
            { step: 2, title: 'Pick up 2 riders', desc: 'You need 2 passengers to qualify for HOV-3. Ask each rider their destination to make sure it works for your route.' },
            { step: 3, title: 'Use the HOV-3 lane', desc: 'With 3 people in the car, you can legally use the HOV-3 express lanes on I-95, I-395, or I-66 — saving 20–45 minutes.' },
            { step: 4, title: 'Drop off at destination', desc: 'Drop riders at the agreed destination. Common drop-offs: Pentagon bus stops, L'Enfant Plaza, 14th St corridor, Rosslyn.' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-4 card">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="text-slate-600 text-sm mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="mb-14 bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <h2 className="text-xl font-bold text-amber-900">Slug Line Rules</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'No money is ever exchanged',
            'No smoking or vaping in the vehicle',
            'Keep conversation quiet — follow the driver's lead',
            'Be ready to board quickly when car arrives',
            'Rider states destination, driver decides to accept',
            'No eating strong-smelling food',
            'No excessive perfume or cologne',
            'Cell phone calls should be brief or avoided',
          ].map((rule) => (
            <div key={rule} className="flex items-start gap-2 text-sm text-amber-800">
              <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              {rule}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-14">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="card">
              <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link href="/dashboard" className="btn-primary inline-block">
          View the Live Board
        </Link>
        <Link href="/spots" className="btn-secondary inline-block ml-4">
          Find Spots Near Me
        </Link>
      </div>

    </div>
  )
}
