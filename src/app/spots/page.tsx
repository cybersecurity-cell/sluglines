import { MapPin, Car, Clock, Navigation } from 'lucide-react'

export const metadata = {
  title: 'Pickup Spots — Sluglines',
  description: 'All slug line pickup spots in Northern Virginia for HOV-3 carpooling.',
}

const SPOTS = [
  {
    name: 'Pentagon City',
    address: 'S Hayes St & Army Navy Dr, Arlington, VA',
    destination: 'Downtown DC / Pentagon',
    highway: 'I-395',
    peakHours: '6:30–9:30 AM, 4:30–7:00 PM',
    directions: 'Near Pentagon City Metro station, street level on S Hayes St.',
    lat: 38.8631, lng: -77.0597,
  },
  {
    name: 'Horner Road (Woodbridge)',
    address: 'Horner Rd & US-1, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95 / I-395',
    peakHours: '5:30–9:00 AM, 4:00–7:00 PM',
    directions: 'Large commuter lot on Horner Road near US Route 1.',
    lat: 38.6354, lng: -77.2710,
  },
  {
    name: 'Potomac Mills',
    address: 'Smoketown Rd & Clover Rd, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    peakHours: '6:00–9:00 AM',
    directions: 'Park-and-ride lot near Potomac Mills mall.',
    lat: 38.6451, lng: -77.3088,
  },
  {
    name: 'Rippon Landing',
    address: 'Rippon Blvd, Woodbridge, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    peakHours: '5:45–8:30 AM',
    directions: 'VRE parking lot on Rippon Blvd.',
    lat: 38.5896, lng: -77.2985,
  },
  {
    name: 'Backlick Road',
    address: 'Backlick Rd & Rolling Rd, Springfield, VA',
    destination: 'Pentagon / Crystal City / Rosslyn',
    highway: 'I-395',
    peakHours: '6:00–9:00 AM, 4:30–7:00 PM',
    directions: 'Park-and-ride at Backlick Road.',
    lat: 38.7565, lng: -77.1697,
  },
  {
    name: 'Rosslyn',
    address: 'N Moore St, Arlington, VA',
    destination: 'DC / Pentagon',
    highway: 'I-66',
    peakHours: '6:30–9:30 AM, 4:30–7:00 PM',
    directions: 'Street pickup near Rosslyn Metro station on N Moore St.',
    lat: 38.8963, lng: -77.0708,
  },
  {
    name: 'Crystal City',
    address: '23rd St S, Arlington, VA',
    destination: 'Downtown DC / Pentagon',
    highway: 'I-395',
    peakHours: '6:30–9:30 AM',
    directions: 'Near Crystal City Metro on 23rd St S.',
    lat: 38.8548, lng: -77.0490,
  },
  {
    name: 'Stafford (Courthouse Road)',
    address: 'Courthouse Rd, Stafford, VA',
    destination: 'Pentagon / Crystal City',
    highway: 'I-95',
    peakHours: '5:30–8:30 AM',
    directions: 'Park-and-ride off Courthouse Rd in Stafford.',
    lat: 38.4660, lng: -77.4116,
  },
]

export default function SpotsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Pickup Spots</h1>
        <p className="text-slate-600 max-w-2xl">
          All established slug line pickup spots in Northern Virginia. 
          Head to the nearest spot during peak hours to find your carpool match.
        </p>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { icon: <Clock className="w-5 h-5 text-blue-600" />, title: 'Best Times', desc: 'Weekdays 6–9 AM and 4–7 PM' },
          { icon: <Car className="w-5 h-5 text-blue-600" />, title: 'The Rules', desc: 'No money exchanged. Rider calls destination. Drop off at agreed point.' },
          { icon: <Navigation className="w-5 h-5 text-blue-600" />, title: 'Etiquette', desc: 'Quiet ride unless driver initiates. No strong perfumes. Be ready when car arrives.' },
        ].map((tip) => (
          <div key={tip.title} className="card flex items-start gap-3">
            <div className="mt-0.5">{tip.icon}</div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{tip.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Spots List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SPOTS.map((spot) => (
          <div key={spot.name} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">{spot.name}</h2>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {spot.address}
                </div>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {spot.highway}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="font-medium text-slate-700 w-20 shrink-0">Destination</span>
                <span className="text-slate-600">{spot.destination}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-700 w-20 shrink-0">Peak Hours</span>
                <span className="text-slate-600">{spot.peakHours}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-slate-700 w-20 shrink-0">Directions</span>
                <span className="text-slate-500 text-xs leading-relaxed">{spot.directions}</span>
              </div>
            </div>

            <a
              href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Navigation className="w-3.5 h-3.5" />
              Open in Google Maps
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
