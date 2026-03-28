import Link from 'next/link'
import { Navigation, Facebook, ExternalLink } from 'lucide-react'

export const metadata = {
  title: 'Pickup Spots — Sluglines',
  description: 'All slug line pickup spots in Northern Virginia for HOV-3 carpooling on I-395/I-95 and I-66 corridors.',
}

type Spot = {
  name: string
  lat: number
  lng: number
  active: boolean
  slug?: string
  fbUrl?: string
}

const MORNING_395_FAIRFAX: Spot[] = [
  { name: "Bob's - Old Keene Mill Rd", lat: 38.7783912, lng: -77.1873566, active: true, slug: 'Bobs-Old-Keene-Mill-Rd', fbUrl: 'https://www.facebook.com/groups/springfieldsluglines/' },
  { name: 'Cardinal Forest Plaza', lat: 38.7794583, lng: -77.2314818, active: true, slug: 'cardinal-forest-plaza' },
  { name: 'Franconia - Springfield', lat: 38.767306, lng: -77.168972, active: false, slug: 'Franconia-Springfield' },
  { name: 'Lorton', lat: 38.715012, lng: -77.213593, active: false, slug: 'Lorton' },
  { name: 'Rolling Valley', lat: 38.7758648, lng: -77.2629826, active: true, slug: 'Rolling-Valley' },
  { name: 'Saratoga', lat: 38.7454983, lng: -77.2100791, active: false, slug: 'Saratoga' },
  { name: 'Sydenstricker Rd', lat: 38.755989, lng: -77.238098, active: true, slug: 'Sydenstricker-Rd' },
]

const MORNING_395_PRINCE_WILLIAM: Spot[] = [
  { name: 'Dale City', lat: 38.646938, lng: -77.341232, active: false, slug: 'Dale-City' },
  { name: 'Horner Rd', lat: 38.658592, lng: -77.280746, active: true, slug: 'Horner-Rd' },
  { name: 'Montclair Fire Station', lat: 38.62624, lng: -77.348183, active: true, slug: 'Montclair-Fire-Station' },
  { name: 'Montclair Northgate', lat: 38.6105087, lng: -77.359309, active: true, slug: 'Montclair-Northgate' },
  { name: 'Old Hechingers', lat: 38.674301, lng: -77.255623, active: true, slug: 'Old-Hechingers' },
  { name: 'Potomac Mills', lat: 38.640717, lng: -77.293884, active: true, slug: 'Potomac-Mills', fbUrl: 'https://www.facebook.com/groups/potomacmillssluglines/' },
  { name: 'Route 123', lat: 38.6701716, lng: -77.2509748, active: true, slug: 'Route-123' },
  { name: 'Route 234', lat: 38.576817, lng: -77.315826, active: true, slug: 'Route-234' },
  { name: 'Tacketts Mill', lat: 38.675777, lng: -77.276543, active: true, slug: 'Tacketts-Mill' },
  { name: 'Telegraph Rd', lat: 38.658051, lng: -77.288749, active: true, slug: 'Telegraph-Rd' },
]

const MORNING_395_STAFFORD: Spot[] = [
  { name: 'Route 17', lat: 38.3461443, lng: -77.5018604, active: true, slug: 'Route-17' },
  { name: 'Route 208', lat: 38.25132, lng: -77.508324, active: false, slug: 'Route-208' },
  { name: 'Route 3 - Gordon Rd', lat: 38.2895891, lng: -77.5634542, active: true, slug: 'Route-3-Gordon-Rd' },
  { name: 'Route 610 - Mine Rd', lat: 38.4669945, lng: -77.4160618, active: true, slug: 'Route-610-Mine-Rd' },
  { name: 'Route 610 - Staffordboro Blvd', lat: 38.4752647, lng: -77.4129771, active: true, slug: 'Route-610-Staffordboro-Blvd' },
  { name: 'Route 630', lat: 38.4212359, lng: -77.4254927, active: true, slug: 'Route-630' },
]

const AFTERNOON_395_FAIRFAX: Spot[] = [
  { name: 'Mark Center', lat: 38.8310454, lng: -77.1176246, active: true, slug: 'Mark-Center', fbUrl: 'https://www.facebook.com/groups/markcenterslugs/' },
  { name: 'Tysons Corner', lat: 38.931906, lng: -77.230132, active: true, slug: 'Tysons-Corner' },
]

const AFTERNOON_395_ARLINGTON: Spot[] = [
  { name: 'Crystal City 12th St', lat: 38.8620732, lng: -77.048738, active: true, slug: 'Crystal-City-12th-St', fbUrl: 'https://www.facebook.com/groups/crystalcitysluglines/' },
  { name: 'Crystal City 23rd St', lat: 38.85238, lng: -77.04964, active: true, slug: 'Crystal-City-23rd-St', fbUrl: 'https://www.facebook.com/groups/crystalcitysluglines/' },
  { name: 'Rosslyn', lat: 38.898092, lng: -77.071726, active: true, slug: 'Rosslyn', fbUrl: 'https://www.facebook.com/groups/rosslynsluglines/' },
  { name: 'The Pentagon', lat: 38.8680768, lng: -77.0524506, active: true, slug: 'The-Pentagon', fbUrl: 'https://www.facebook.com/groups/pentagonsluglines/' },
]

const AFTERNOON_395_DC: Spot[] = [
  { name: '14th St and Constitution Ave', lat: 38.889938, lng: -77.032021, active: true, slug: '14th-St-and-Constitution-Ave' },
  { name: '14th St and G St', lat: 38.8981415, lng: -77.0320751, active: true, slug: '14th-St-and-G-St' },
  { name: '14th St and Independence', lat: 38.88733, lng: -77.032156, active: true, slug: '14th-St-and-Independence' },
  { name: '14th St at Commerce Dept.', lat: 38.89462, lng: -77.03207, active: true, slug: '14th-St-at-Commerce-Dept' },
  { name: '15th St and New York Ave', lat: 38.8990078, lng: -77.033381, active: true, slug: '15th-St-and-New-York-Ave' },
  { name: '19th St and F St', lat: 38.896695, lng: -77.043543, active: true, slug: '19th-St-and-F-St' },
  { name: '19th St and I St', lat: 38.900711, lng: -77.043549, active: true, slug: '19th-St-and-I-St' },
  { name: "L'Enfant Plaza", lat: 38.88489, lng: -77.023402, active: true, slug: 'LEnfant-Plaza', fbUrl: 'https://www.facebook.com/groups/lenfantslugs/' },
  { name: 'Navy Yard', lat: 38.8765811, lng: -77.0014703, active: true, slug: 'Navy-Yard' },
]

const MORNING_66_FAIRFAX: Spot[] = [
  { name: 'Fairfax Govt', lat: 38.8542902, lng: -77.3604273, active: true, slug: 'Fairfax-Govt' },
  { name: 'Herndon-Monroe PnR', lat: 38.9513106, lng: -77.3823065, active: true, slug: 'Herndon-Monroe-PnR' },
  { name: 'Stringfellow PnR', lat: 38.854028, lng: -77.404472, active: true, slug: 'Stringfellow-PnR' },
  { name: 'Vienna Metro South KnR', lat: 38.8774069, lng: -77.2706202, active: true, slug: 'Vienna-Metro-South-KnR', fbUrl: 'https://www.facebook.com/groups/viennaslugs/' },
]

const MORNING_66_PRINCE_WILLIAM: Spot[] = [
  { name: 'Cushing Road', lat: 38.7950597, lng: -77.563859, active: true, slug: 'Cushing-Road' },
]

const MORNING_66_LOUDOUN: Spot[] = [
  { name: 'East Gate', lat: 38.9119294, lng: -77.4914467, active: true, slug: 'East-Gate' },
  { name: 'Stone Ridge', lat: 38.938222, lng: -77.555917, active: true, slug: 'Stone-Ridge' },
]

const AFTERNOON_66_ARLINGTON: Spot[] = [
  { name: 'Rosslyn', lat: 38.896361, lng: -77.069444, active: true, slug: 'Rosslyn', fbUrl: 'https://www.facebook.com/groups/rosslynsluglines/' },
  { name: 'The Pentagon', lat: 38.866806, lng: -77.056056, active: true, slug: 'The-Pentagon', fbUrl: 'https://www.facebook.com/groups/pentagonsluglines/' },
]

const AFTERNOON_66_DC: Spot[] = [
  { name: '15th St and New York Ave', lat: 38.899133, lng: -77.033086, active: true, slug: '15th-St-and-New-York-Ave' },
  { name: '19th St and F St', lat: 38.8970281, lng: -77.0435598, active: true, slug: '19th-St-and-F-St' },
  { name: 'Foggy Bottom', lat: 38.90075, lng: -77.049611, active: true, slug: 'Foggy-Bottom' },
  { name: "L'Enfant Plaza", lat: 38.8849257, lng: -77.0211657, active: true, slug: 'LEnfant-Plaza', fbUrl: 'https://www.facebook.com/groups/lenfantslugs/' },
  { name: 'Navy Yard', lat: 38.8766068, lng: -77.0009934, active: true, slug: 'Navy-Yard' },
]

function SpotItem({ name, lat, lng, active, slug, fbUrl }: Spot) {
  return (
    <li className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--border)', opacity: active ? 1 : 0.45 }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? 'var(--green)' : 'var(--muted)' }}></span>
        {slug ? (
          <a href={'https://sluglines.com/slug_pickup/' + slug + '/'} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-white transition-colors truncate" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
            {name}
          </a>
        ) : (
          <span className="text-sm truncate" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>{name}</span>
        )}
        {!active && <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>Inactive</span>}
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {fbUrl && (
          <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs transition-colors hover:text-blue-400" style={{ color: 'var(--muted)' }} title="Facebook Group">
            <Facebook className="w-4 h-4" />
          </a>
        )}
        <a href={'https://google.com/maps/?q='+lat+','+lng} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs transition-colors hover:text-white" style={{ color: 'var(--accent)' }}>
          <Navigation className="w-4 h-4" />Map
        </a>
      </div>
    </li>
  )
}

function SpotGroup({ county, spots }: { county: string; spots: Spot[] }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}>
        <h3 className="font-semibold text-sm text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{county}</h3>
      </div>
      <ul className="px-4">{spots.map(s => <SpotItem key={s.name} {...s} />)}</ul>
    </div>
  )
}

export default function SpotsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-12">
        <p className="section-label mb-3">Corridors</p>
        <h1 className="text-4xl md:text-5xl text-white mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>Slugging Locations</h1>
        <p className="text-lg max-w-2xl" style={{ color: 'var(--muted)' }}>All established slug line pickup and drop-off spots in Northern Virginia. Green = active.</p>
      </div>

      <div className="flex flex-wrap items-center gap-6 mb-10 text-sm p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }}></span><span style={{ color: 'var(--muted)' }}>Active spot</span></div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--muted)' }}></span><span style={{ color: 'var(--muted)' }}>Inactive</span></div>
        <div className="flex items-center gap-2"><Facebook className="w-4 h-4" style={{ color: '#4267B2' }} /><span style={{ color: 'var(--muted)' }}>Facebook group</span></div>
        <div className="flex items-center gap-2"><Navigation className="w-4 h-4" style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--muted)' }}>Google Maps</span></div>
        <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4" style={{ color: 'var(--muted)' }} /><span style={{ color: 'var(--muted)' }}>Click name for full details on sluglines.com</span></div>
      </div>

      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#fc8181', border: '1px solid rgba(248,113,113,0.2)' }}>I-395 / I-95</span>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>I-395 / I-95 Corridor</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Morning — Suburbs to DC</h3>
            <div className="space-y-4">
              <SpotGroup county="Fairfax" spots={MORNING_395_FAIRFAX} />
              <SpotGroup county="Prince William" spots={MORNING_395_PRINCE_WILLIAM} />
              <SpotGroup county="Stafford / Fredericksburg" spots={MORNING_395_STAFFORD} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Afternoon — DC to Suburbs</h3>
            <div className="space-y-4">
              <SpotGroup county="Fairfax / Alexandria" spots={AFTERNOON_395_FAIRFAX} />
              <SpotGroup county="Arlington" spots={AFTERNOON_395_ARLINGTON} />
              <SpotGroup county="Washington DC" spots={AFTERNOON_395_DC} />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(99,179,237,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,179,237,0.2)' }}>I-66</span>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>I-66 Corridor</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Morning — Suburbs to DC</h3>
            <div className="space-y-4">
              <SpotGroup county="Fairfax" spots={MORNING_66_FAIRFAX} />
              <SpotGroup county="Prince William" spots={MORNING_66_PRINCE_WILLIAM} />
              <SpotGroup county="Loudoun" spots={MORNING_66_LOUDOUN} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Afternoon — DC to Suburbs</h3>
            <div className="space-y-4">
              <SpotGroup county="Arlington" spots={AFTERNOON_66_ARLINGTON} />
              <SpotGroup county="Washington DC" spots={AFTERNOON_66_DC} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
