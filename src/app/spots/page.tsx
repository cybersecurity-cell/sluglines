import { MapPin, Car, Clock, Navigation, Sun, Sunset } from 'lucide-react'

export const metadata = {
    title: 'Pickup Spots — Sluglines',
    description: 'All slug line pickup spots in Northern Virginia for HOV-3 carpooling on I-395/I-95 and I-66 corridors.',
}

// I-395 / I-95 CORRIDOR — Morning (outbound from suburbs to DC)
const MORNING_395_FAIRFAX = [
  { name: "Bob's - Old Keene Mill Rd", lat: 38.7783912, lng: -77.1873566, active: true },
  { name: 'Cardinal Forest Plaza', lat: 38.7794583, lng: -77.2314818, active: true },
  { name: 'Franconia - Springfield', lat: 38.767306, lng: -77.168972, active: false },
  { name: 'Landmark Mall', lat: 38.817306, lng: -77.131083, active: false },
  { name: 'Lorton', lat: 38.715012, lng: -77.213593, active: false },
  { name: 'Rolling Valley', lat: 38.7758648, lng: -77.2629826, active: true },
  { name: 'Saratoga', lat: 38.7454983, lng: -77.2100791, active: false },
  { name: 'Springfield Town Center', lat: 38.7723647, lng: -77.1729664, active: true },
  { name: 'Sydenstricker Rd', lat: 38.755989, lng: -77.238098, active: true },
  { name: 'Van Dorn St', lat: 38.800778, lng: -77.131361, active: false },
  ]

const MORNING_395_PRINCE_WILLIAM = [
  { name: 'Dale City', lat: 38.646938, lng: -77.341232, active: false },
  { name: 'Horner Rd', lat: 38.658592, lng: -77.280746, active: true },
  { name: 'Montclair Fire Station', lat: 38.62624, lng: -77.348183, active: true },
  { name: 'Montclair Northgate', lat: 38.6105087, lng: -77.359309, active: true },
  { name: 'Old Hechingers', lat: 38.674301, lng: -77.255623, active: true },
  { name: 'Potomac Mills', lat: 38.640717, lng: -77.293884, active: true },
  { name: 'Route 123', lat: 38.6701716, lng: -77.2509748, active: true },
  { name: 'Route 234', lat: 38.576817, lng: -77.315826, active: true },
  { name: "Tacketts Mill", lat: 38.675777, lng: -77.276543, active: true },
  { name: 'Telegraph Rd', lat: 38.658051, lng: -77.288749, active: true },
  ]

const MORNING_395_STAFFORD = [
  { name: 'Route 17', lat: 38.3461443, lng: -77.5018604, active: true },
  { name: 'Route 208', lat: 38.25132, lng: -77.508324, active: false },
  { name: 'Route 3 - Gordon Rd', lat: 38.2895891, lng: -77.5634542, active: true },
  { name: 'Route 610 - Mine Rd', lat: 38.4669945, lng: -77.4160618, active: true },
  { name: 'Route 610 - Staffordboro Blvd', lat: 38.4752647, lng: -77.4129771, active: true },
  { name: 'Route 630', lat: 38.4212359, lng: -77.4254927, active: true },
  ]

// I-395 / I-95 CORRIDOR — Afternoon (drop-offs in DC/Arlington)
const AFTERNOON_395_FAIRFAX = [
  { name: 'Mark Center', lat: 38.8310454, lng: -77.1176246, active: true, fbUrl: 'https://www.facebook.com/groups/markcentersluglines/' },
  { name: 'Tysons Corner', lat: 38.931906, lng: -77.230132, active: true, fbUrl: 'https://www.facebook.com/groups/tysonssluglines/' },
  ]

const AFTERNOON_395_ARLINGTON = [
  { name: 'Crystal City 12th St', lat: 38.8620732, lng: -77.048738, active: true },
  { name: 'Crystal City 23rd St', lat: 38.85238, lng: -77.04964, active: true },
  { name: 'Rosslyn', lat: 38.898092, lng: -77.071726, active: true },
  { name: 'The Pentagon', lat: 38.8680768, lng: -77.0524506, active: true },
  ]

const AFTERNOON_395_DC = [
  { name: '14th St and Constitution Ave', lat: 38.889938, lng: -77.032021, active: true },
  { name: '14th St and G St', lat: 38.8981415, lng: -77.0320751, active: true },
  { name: '14th St and Independence', lat: 38.88733, lng: -77.032156, active: true },
  { name: '14th St at Commerce Dept.', lat: 38.89462, lng: -77.03207, active: true },
  { name: '15th St and New York Ave', lat: 38.8990078, lng: -77.033381, active: true },
  { name: '19th St and F St', lat: 38.896695, lng: -77.043543, active: true },
  { name: '19th St and I St', lat: 38.900711, lng: -77.043549, active: true },
  { name: "L'Enfant Plaza", lat: 38.88489, lng: -77.023402, active: true },
  { name: 'Navy Yard', lat: 38.8765811, lng: -77.0014703, active: true },
  { name: 'State Department', lat: 38.8949212, lng: -77.0461794, active: true },
  ]

// I-66 CORRIDOR — Morning
const MORNING_66_FAIRFAX = [
  { name: 'Fairfax Govt', lat: 38.8542902, lng: -77.3604273, active: true, fbUrl: 'https://www.facebook.com/groups/I66Sluglines/' },
  { name: 'Herndon-Monroe PnR', lat: 38.9513106, lng: -77.3823065, active: true, fbUrl: 'https://www.facebook.com/groups/HerndonSlugLines/' },
  { name: 'Stringfellow PnR', lat: 38.854028, lng: -77.404472, active: true, fbUrl: 'https://www.facebook.com/groups/CentrevilleSlugLines/' },
  { name: 'Vienna Metro South KnR', lat: 38.8774069, lng: -77.2706202, active: true, fbUrl: 'https://www.facebook.com/groups/I66Sluglines/' },
  ]

const MORNING_66_PRINCE_WILLIAM = [
  { name: 'Cushing Road', lat: 38.7950597, lng: -77.563859, active: true },
  { name: 'University Blvd', lat: 38.798972, lng: -77.5885, active: true },
  ]

const MORNING_66_LOUDOUN = [
  { name: 'East Gate', lat: 38.9119294, lng: -77.4914467, active: true },
  { name: 'Stone Ridge', lat: 38.938222, lng: -77.555917, active: true },
  ]

// I-66 CORRIDOR — Afternoon
const AFTERNOON_66_ARLINGTON = [
  { name: 'Rosslyn', lat: 38.896361, lng: -77.069444, active: true },
  { name: 'The Pentagon', lat: 38.866806, lng: -77.056056, active: true },
  ]

const AFTERNOON_66_DC = [
  { name: '15th St and New York Ave', lat: 38.899133, lng: -77.033086, active: true },
  { name: '19th St and F St', lat: 38.8970281, lng: -77.0435598, active: true },
  { name: 'Foggy Bottom', lat: 38.90075, lng: -77.049611, active: true },
  { name: "L'Enfant Plaza", lat: 38.8849257, lng: -77.0211657, active: true },
  { name: 'Navy Yard', lat: 38.8766068, lng: -77.0009934, active: true },
  ]

function SpotItem({ name, lat, lng, active }: { name: string; lat: number; lng: number; active: boolean }) {
    return (
          <li className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${!active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-slate-300'}`}></span>span>
                          <span className="text-sm text-slate-800">{name}</span>span>
                    {!active && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Inactive</span>span>}
                  </div>div>
                <a
                          href={`https://google.com/maps/?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 shrink-0 ml-2"
                        >
                        <Navigation className="w-3 h-3" />
                        Map
                </a>a>
          </li>li>
        )
}

function SpotGroup({ title, spots, county }: { title: string; spots: { name: string; lat: number; lng: number; active: boolean; fbUrl?: string }[]; county: string }) {
    return (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">{county}</h3>h3>
                </div>div>
                <ul className="px-4 divide-y divide-slate-100">
                  {spots.map((s) => (
                      <SpotItem key={s.name} {...s} />
                    ))}
                </ul>ul>
          </div>div>
        )
}

export default function SpotsPage() {
    return (
          <div className="max-w-6xl mx-auto px-4 py-10">
                <div className="mb-8">
                        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Slugging Locations</h1>h1>
                        <p className="text-slate-600 max-w-2xl">
                                  All established slug line pickup and drop-off spots in Northern Virginia, organized by corridor. Green dots indicate active spots.
                        </p>p>
                </div>div>
          
            {/* Tips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                  {[
            { icon: <Clock className="w-5 h-5 text-blue-600" />, title: 'Best Times', desc: 'Weekdays 6–9 AM and 4–7 PM' },
            { icon: <Car className="w-5 h-5 text-blue-600" />, title: 'The Rules', desc: 'No money exchanged. Rider calls destination. Drop off at agreed point.' },
            { icon: <Navigation className="w-5 h-5 text-blue-600" />, title: 'Etiquette', desc: 'Quiet ride unless driver initiates. No strong perfumes. Be ready when car arrives.' },
                    ].map((tip) => (
                                <div key={tip.title} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                                            <div className="mt-0.5">{tip.icon}</div>div>
                                            <div>
                                                          <h3 className="font-semibold text-slate-900 text-sm">{tip.title}</h3>h3>
                                                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tip.desc}</p>p>
                                            </div>div>
                                </div>div>
                              ))}
                </div>div>
          
            {/* I-395 / I-95 Corridor */}
                <section className="mb-12">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-sm font-bold">I-395 / I-95 CORRIDOR</span>span>
                        </h2>h2>
                
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Morning */}
                                  <div>
                                              <div className="flex items-center gap-2 mb-4">
                                                            <Sun className="w-5 h-5 text-orange-500" />
                                                            <h3 className="text-lg font-bold text-slate-800">Morning Sluglines</h3>h3>
                                                            <span className="text-xs text-slate-500">(Suburbs → DC)</span>span>
                                              </div>div>
                                              <div className="space-y-4">
                                                            <SpotGroup title="Morning 395 Fairfax" county="Fairfax" spots={MORNING_395_FAIRFAX} />
                                                            <SpotGroup title="Morning 395 PW" county="Prince William" spots={MORNING_395_PRINCE_WILLIAM} />
                                                            <SpotGroup title="Morning 395 Stafford" county="Stafford" spots={MORNING_395_STAFFORD} />
                                              </div>div>
                                  </div>div>
                        
                          {/* Afternoon */}
                                  <div>
                                              <div className="flex items-center gap-2 mb-4">
                                                            <Sunset className="w-5 h-5 text-purple-500" />
                                                            <h3 className="text-lg font-bold text-slate-800">Afternoon Sluglines</h3>h3>
                                                            <span className="text-xs text-slate-500">(DC → Suburbs)</span>span>
                                              </div>div>
                                              <div className="space-y-4">
                                                            <SpotGroup title="Afternoon 395 Fairfax" county="Fairfax" spots={AFTERNOON_395_FAIRFAX} />
                                                            <SpotGroup title="Afternoon 395 Arlington" county="Arlington" spots={AFTERNOON_395_ARLINGTON} />
                                                            <SpotGroup title="Afternoon 395 DC" county="Washington DC" spots={AFTERNOON_395_DC} />
                                              </div>div>
                                  </div>div>
                        </div>div>
                </section>section>
          
            {/* I-66 Corridor */}
                <section className="mb-12">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm font-bold">I-66 CORRIDOR</span>span>
                        </h2>h2>
                
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Morning */}
                                  <div>
                                              <div className="flex items-center gap-2 mb-4">
                                                            <Sun className="w-5 h-5 text-orange-500" />
                                                            <h3 className="text-lg font-bold text-slate-800">Morning Sluglines</h3>h3>
                                                            <span className="text-xs text-slate-500">(Suburbs → DC)</span>span>
                                              </div>div>
                                              <div className="space-y-4">
                                                            <SpotGroup title="Morning 66 Fairfax" county="Fairfax" spots={MORNING_66_FAIRFAX} />
                                                            <SpotGroup title="Morning 66 PW" county="Prince William" spots={MORNING_66_PRINCE_WILLIAM} />
                                                            <SpotGroup title="Morning 66 Loudoun" county="Loudoun" spots={MORNING_66_LOUDOUN} />
                                              </div>div>
                                  </div>div>
                        
                          {/* Afternoon */}
                                  <div>
                                              <div className="flex items-center gap-2 mb-4">
                                                            <Sunset className="w-5 h-5 text-purple-500" />
                                                            <h3 className="text-lg font-bold text-slate-800">Afternoon Sluglines</h3>h3>
                                                            <span className="text-xs text-slate-500">(DC → Suburbs)</span>span>
                                              </div>div>
                                              <div className="space-y-4">
                                                            <SpotGroup title="Afternoon 66 Arlington" county="Arlington" spots={AFTERNOON_66_ARLINGTON} />
                                                            <SpotGroup title="Afternoon 66 DC" county="Washington DC" spots={AFTERNOON_66_DC} />
                                              </div>div>
                                  </div>div>
                        </div>div>
                </section>section>
          
            {/* Legend */}
                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-6 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span>span> Active spot</div>div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300"></span>span> Inactive spot</div>div>
                        <div className="flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-600" /> Opens Google Maps</div>div>
                </div>div>
          </div>div>
        )
}</div>
