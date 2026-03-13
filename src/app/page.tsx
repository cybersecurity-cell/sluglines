import Link from 'next/link'
import { Car, Users, MapPin, Clock, Shield, Smartphone } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live riders &amp; drivers updating now
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-tight">
          Skip the Traffic.<br />
          <span className="text-blue-600">Ride the HOV-3 Lane.</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Sluglines connects Northern Virginia commuters for instant HOV-3 carpools.
          Find a driver or rider at your nearest slug line spot in seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard" className="btn-primary text-center">
            View Live Board
          </Link>
          <Link href="/how-it-works" className="btn-secondary text-center">
            How It Works
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-lg mx-auto">
          {[
            { label: 'Active Spots', value: '12+' },
            { label: 'Daily Commuters', value: '2,000+' },
            { label: 'Avg Wait', value: '< 5 min' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-blue-600">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How Slugging Works */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">What is Slugging?</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-12">
            Slugging is a unique form of commuter carpooling in Northern Virginia where strangers share rides 
            to use HOV-3 lanes on I-95, I-395, and I-66 — saving time and money for everyone.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <MapPin className="w-8 h-8 text-blue-600" />,
                title: 'Go to a Spot',
                desc: 'Head to one of the designated slug line pickup spots across Northern Virginia.',
              },
              {
                icon: <Users className="w-8 h-8 text-blue-600" />,
                title: 'Match Up',
                desc: 'Drivers pick up 2 riders going to the same destination to qualify for HOV-3.',
              },
              {
                icon: <Car className="w-8 h-8 text-blue-600" />,
                title: 'Save Time',
                desc: 'Use the express HOV-3 lane and cut your commute by up to 45 minutes.',
              },
            ].map((step) => (
              <div key={step.title} className="card text-center hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-4">{step.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Why Use Sluglines?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Clock className="w-6 h-6 text-blue-600" />, title: 'Real-Time Updates', desc: 'See exactly how many drivers and riders are waiting at each spot right now.' },
            { icon: <MapPin className="w-6 h-6 text-blue-600" />, title: 'All Major Spots', desc: 'Coverage for Pentagon, Crystal City, Rosslyn, Woodbridge, Horner Road, and more.' },
            { icon: <Smartphone className="w-6 h-6 text-blue-600" />, title: 'Mobile App', desc: 'Available on iOS and Android. Check wait times from your phone before you leave.' },
            { icon: <Shield className="w-6 h-6 text-blue-600" />, title: 'Safe & Trusted', desc: 'Slug lines have a decades-long safety record. It is a time-honored commuter tradition.' },
            { icon: <Users className="w-6 h-6 text-blue-600" />, title: 'Community Driven', desc: 'Updates come from real commuters in the community keeping each other informed.' },
            { icon: <Car className="w-6 h-6 text-blue-600" />, title: 'Free to Use', desc: 'No fares exchanged. Drivers and riders both benefit from the HOV-3 time savings.' },
          ].map((f) => (
            <div key={f.title} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                {f.icon}
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16 text-center text-white">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Beat the Beltway?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of Northern Virginia commuters who save time every day using the HOV-3 slug lines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="bg-white text-blue-600 font-semibold py-3 px-8 rounded-xl hover:bg-blue-50 transition-colors">
              View Live Board
            </Link>
            <Link href="/spots" className="border-2 border-white text-white font-semibold py-3 px-8 rounded-xl hover:bg-blue-700 transition-colors">
              Find Spots Near Me
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
