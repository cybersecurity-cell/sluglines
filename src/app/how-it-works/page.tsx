import Link from 'next/link'
import { MapPin, Users, Car, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'How It Works â Sluglines',
  description: 'Learn how slugging works for Northern Virginia HOV-3 carpooling.',
}

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-14">
        <p className="section-label mb-3">The process</p>
        <h1 className="text-4xl md:text-5xl text-white mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>HowSlugging Works</h1>
        <p className="text-lg" style={{ color: 'var(--muted)' }}>Slugging is Northern Virginia&apos;s unofficial carpool system that has operated for decades on trust and mutual benefit.</p>
      </div>
      <div className="space-y-6 mb-16">
        {[{ step: '01', icon: <MapPin className="w-6 h-6" />, title: 'Go to a Slug Line Spot', desc: 'Head to one of the designated pickup locations across Northern Virginia. Riders form a line and wait quietly.' },{ step: '02', icon: <Car className="w-6 h-6" />, title: 'Driver Announces Destination', desc: "A driver pulls up and announces their destination â either with a sign or by calling it out. Riders at the front of the line for that destination get in." },{ step: '03', icon: <Users className="w6 h-6" />, title: 'Fill the HOV-3 Requirement', desc: 'The driver picks up 2 riders to qualify for HOV-3 status. All three now have access to the express lanes.' },{ step: '04', icon: <ArrowRight className="w-6 h-6" />, title: 'Drop Off at Destination', desc: 'Driver drops riders at the agreed-upon location. No money exchanged â ever. Everyone saved time.' }].map(s => (
          <div key={s.step} className="flex gap-5 p-6 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w41 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(99,179,237,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,179,237,0.2)' }}>{s.icon}</div>
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{s.step}</div>
              <h3 className="font-bold text-white text-lg mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-14">
        <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>Common Questions</h2>
        <div className="space-y-4">
          {[{ q: 'Is slugging safe?', a: "Slugging has operated in Northern Virginia since the 1970s with an excellent safety record." },{ q: 'Do I need to register or pay?', a: 'No. Slugging is completely free and informal. No money is ever exchanged between drivers and riders.' },{ q: 'What are the peak hours?', a: 'Morning slugging runs 6-9 AM (suburbs to DC). Afternoon runs 4-7 PM (DC to suburbs).' },{ q: 'Can I request a specific route?', a: 'No â riders take the first car heading to their destination.' }].map(faq => (
            <div key={faq.q} className="p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{faq.q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'rgba(99,179,237,0.2)' }}>
        <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>Ready to try it?</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Find your nearest pickup spot and check live wait times.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/spots" className="btn-primary text-sm">View Slug Spots</Link>
          <Link href="/slugging-rules" className="btn-secondary text-sm">Read the Rules</Link>
        </div>
      </div>
    </div>
  )
}
