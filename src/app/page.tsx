import Link from 'next/link'
import { Car, Users, MapPin, Clock, Shield, Smartphone, ArrowRight, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Orbs */}
        <div className="orb w-[600px] h-[600px] -top-40 -right-32 opacity-20" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}></div>
        <div className="orb w-[400px] h-[400px] bottom-0 left-0 opacity-10" style={{ background: 'radial-gradient(circle, #f6ad55 0%, transparent 70%)' }}></div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-20 pb-24 w-full">
          <div className="max-w-3xl">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full text-sm font-medium border" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)', color: '#4ade80' }}>
              <span className="live-dot"></span>
              Riders &amp; drivers updating live right now
            </div>

            <h1
              className="text-6xl md:text-7xl lg:text-8xl text-white mb-7 leading-none"
              style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.03em' }}
            >
              Skip the<br />
              <span style={{ color: 'var(--accent)' }}>Traffic.</span>
            </h1>

            <p className="text-xl md:text-2xl mb-10 max-w-xl leading-relaxed" style={{ color: 'var(--muted)' }}>
              Northern Virginia&apos;s HOV-3 carpool network. Find a driver or rider at your nearest slug line spot in seconds â free, trusted, and decades-proven.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard" className="btn-primary text-base shadow-lg shadow-sky-500/25">
                <Zap className="w-4 h-4" />
                View Live Board
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/how-it-works" className="btn-secondary text-base">
                How It Works
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t" style={{ borderColor: 'var(--border)' }}>
              {[
                { value: '40+', label: 'Active spots' },
                { value: '2,000+', label: 'Daily commuters' },
                { value: '< 5 min', label: 'Average wait' },
                { value: 'Free', label: 'Always' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {s.value}
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Corridors band */}
      <div className="border-y py-4 overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-12 px-4 max-w-6xl mx-auto text-sm" style={{ color: 'var(--muted)' }}>
          {['I-95 Corridor', 'I-395 Corridor', 'I-66 Corridor', 'Pentagon', 'Crystal City', 'Rosslyn', 'Woodbridge', 'Dale City', 'Stafford', 'Herndon'].map((s) => (
            <span key={s} className="shrink-0">{s}</span>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <section className="py-28 max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <p className="section-label mb-3">The system</p>
          <h2
            className="text-4xl md:text-5xl text-white"
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            What is Slugging?
          </h2>
          <p className="mt-5 max-w-xl mx-auto text-lg" style={{ color: 'var(--muted)' }}>
            A time-honored commuter tradition where strangers share rides to use HOV-3 lanes â saving up to 45 minutes each way.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              icon: <MapPin className="w-6 h-6" style={{ color: 'var(--accent)' }} />,
              title: 'Go to a Spot',
              desc: 'Head to any of the established slug line pickup locations across Northern Virginia.',
            },
            {
              step: '02',
              icon: <Users className="w-6 h-6" style={{ color: 'var(--accent)' }} />,
              title: 'Match Up',
              desc: 'Drivers pick up 2 riders going to the same destination to qualify for HOV-3.',
            },
            {
              step: '03',
              icon: <Car className="w6 h-6" style={{ color: 'var(--accent)' }} />,
              title: 'Save Time',
              desc: 'Glide past gridlock in the express HOV-3 lane. No money exchanged. Ever.',
            },
          ].map((s) => (
            <div key={s.step} className="card card-hover relative overflow-hidden group">
              <div
                className="absolute top-4 right-4 text-5xl font-bold opacity-5 group-hover:opacity-10 transition-opacity"
                style={{ fontFamily: 'Syne, sans-serif', color: 'var(--accent)' }}
              >
                {s.step}
              </div>
              <div
                className="w41 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.2)' }}
              >
                {s.icon}
              </div>
              <h3 className="font-bold text-lg text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Why Sluglines</p>
            <h2 className="text-4xl md:text-5xl text-white" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Everything you need
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Clock className="w5 h-5" />, title: 'Real-Time Updates', desc: 'Live driver and rider counts at every spot, updated by real commuters in the field.' },
              { icon: <MapPin className="w-5 h-5" />, title: 'All Major Spots', desc: 'Pentagon, Crystal City, Rosslyn, Woodbridge, Horner Rd, and 35+ more locations.' },
              { icon: <Smartphone className="w5 h-5" />, title: 'Mobile App', desc: 'iOS & Android. Check wait times from home before you head out.' },
              { icon: <Shield className="w-5 h-5" />, title: 'Safe & Trusted', desc: 'Decades-long safety record. A time-honored Northern Virginia tradition.' },
              { icon: <Users className="w5 h-5" />, title: 'Community Driven', desc: 'Updates come from real commuters keeping each other informed.' },
              { icon: <Car className="w5 h-5" />, title: 'Always Free', desc: 'No fares exchanged. Drivers and riders both win with HOV-3 time savings.' },
            ].map((f) => (
              <div key={f.title} className="card card-hover">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(99,179,237,0.08)', color: 'var(--accent)' }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{ftitle}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 max-w-6xl mx-auto px-4 text-center">
        <div className="relative inline-block w-full max-w-2xl">
          <div className="orb w-96 h-96 -z-10 opacity-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}></div>
          <p className="section-label mb-5">Ready?</p>
          <h2 className="text-4xl md:text-5xl text-white mb-6" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Beat the Beltway<br />every single day.
          </h2>
          <p className="text-lg mb-10" style={{ color: 'var(--muted)' }}>
            Join thousands of Northern Virginia commuters who save time using HOV-3 slug lines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="btn-primary text-base shadow-xl shadow-sky-500/20">
              <Zap className="w-4 h-4" />
              View Live Board
            </Link>
            <Link href="/spots" className="btn-secondary text-base">
              Find Spots Near Me
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
