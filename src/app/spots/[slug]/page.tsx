import Link from 'next/link'
import { ArrowLeft, Navigation, Facebook, ExternalLink, Clock, MapPin, Bus, Users } from 'lucide-react'
import { notFound } from 'next/navigation'

// All known sluglines.com location slugs mapped to metadata
const SPOT_DATA: Record<string, {
  name: string
  corridor: string
  direction: string
  county: string
  lat: number
  lng: number
  active: boolean
  description?: string
  peakHours?: string
  parking?: string
  linesFrom?: string[]
  linesTo?: string[]
  fbGroups?: { name: string; url: string }[]
  transit?: string[]
  notes?: string
}> = {
  'Bobs-Old-Keene-Mill-Rd': {
    name: "Bob's – Old Keene Mill Rd",
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.7783912, lng: -77.1873566, active: true,
    description: "One of the oldest slugging lots, believed to be functioning since 1975. There are 2 slug staging areas at Bob's — the Keene Mill Park and Ride behind the gas station goes to 18th, 20th and 23rd Street. The line away from the gas station goes to 14th Street and L'Enfant.",
    peakHours: '5:45 AM – 8:00 AM',
    parking: 'Approx. 685 spaces across Springfield Plaza, American Legion, and surrounding lots. Gets full by 7:00 AM.',
    linesFrom: ["L'Enfant Plaza", '14th at Commerce Dept.', '18th Street'],
    linesTo: ["L'Enfant Plaza", '14th at Commerce Dept.', '14th & Madison Dr', '19th & F Street'],
    fbGroups: [
      { name: 'Springfield Slug Lines', url: 'https://www.facebook.com/groups/springfieldsluglines/' },
      { name: 'Springfield Town Center', url: 'https://www.facebook.com/groups/stcsluglines' },
    ],
    transit: ['Fairfax Connector Route 306', 'Fairfax Connector Route 18G'],
    notes: "Bob's lot is also called Old Keene Mill, Springfield Plaza, Springfield Mall, Long John Silvers, Chi Chi's.",
  },
  'cardinal-forest-plaza': {
    name: 'Cardinal Forest Plaza',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.7794583, lng: -77.2314818, active: true,
    description: 'Cardinal Forest Plaza is a slug pickup location in the Fairfax/Springfield area serving commuters heading to DC destinations.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ["L'Enfant Plaza", 'Pentagon', '14th Street'],
    linesTo: ['14th Street', "L'Enfant Plaza"],
    fbGroups: [{ name: 'Springfield Slug Lines', url: 'https://www.facebook.com/groups/springfieldsluglines/' }],
  },
  'Franconia-Springfield': {
    name: 'Franconia – Springfield',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.767306, lng: -77.168972, active: false,
    description: 'Franconia-Springfield is currently inactive as a slug pickup location.',
    notes: 'This location is currently inactive.',
  },
  'Lorton': {
    name: 'Lorton',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.715012, lng: -77.213593, active: false,
    description: 'Lorton slug pickup location is currently inactive.',
    notes: 'This location is currently inactive.',
  },
  'Rolling-Valley': {
    name: 'Rolling Valley',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.7758648, lng: -77.2629826, active: true,
    description: 'Rolling Valley is an active slug pickup location in the Burke/Springfield area of Fairfax County.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
    fbGroups: [{ name: 'Springfield Slug Lines', url: 'https://www.facebook.com/groups/springfieldsluglines/' }],
  },
  'Saratoga': {
    name: 'Saratoga',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.7454983, lng: -77.2100791, active: false,
    description: 'Saratoga slug pickup location is currently inactive.',
    notes: 'This location is currently inactive.',
  },
  'Sydenstricker-Rd': {
    name: 'Sydenstricker Rd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Fairfax',
    lat: 38.755989, lng: -77.238098, active: true,
    description: 'Sydenstricker Road is an active slug pickup location in Fairfax County serving commuters heading into DC.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ["L'Enfant Plaza", 'Pentagon', '14th Street'],
  },
  'Route-3-Gordon-Rd': {
    name: 'Route 3 – Gordon Rd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford/Fredericksburg',
    lat: 38.2895891, lng: -77.5634542, active: true,
    description: 'Route 3 at Gordon Road serves commuters from the Fredericksburg area heading north to DC destinations.',
    peakHours: '5:30 AM – 7:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Route-17': {
    name: 'Route 17',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford/Fredericksburg',
    lat: 38.3461443, lng: -77.5018604, active: true,
    description: 'Route 17 serves commuters from the Stafford area heading to DC via I-95/I-395.',
    peakHours: '5:30 AM – 7:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Route-208': {
    name: 'Route 208',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford/Fredericksburg',
    lat: 38.25132, lng: -77.508324, active: false,
    description: 'Route 208 slug pickup location is currently inactive.',
    notes: 'This location is currently inactive.',
  },
  'Dale-City': {
    name: 'Dale City',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.646938, lng: -77.341232, active: false,
    description: 'Dale City slug pickup location is currently inactive.',
    notes: 'This location is currently inactive.',
  },
  'Horner-Rd': {
    name: 'Horner Rd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.658592, lng: -77.280746, active: true,
    description: 'Horner Road is an active slug pickup location in Prince William County.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Montclair-Fire-Station': {
    name: 'Montclair Fire Station',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.62624, lng: -77.348183, active: true,
    description: 'Montclair Fire Station is an active slug pickup spot in the Montclair community of Prince William County.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
    fbGroups: [{ name: 'Montclair Sluglines', url: 'https://www.facebook.com/groups/montclairslugs/' }],
  },
  'Montclair-Northgate': {
    name: 'Montclair Northgate',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.6105087, lng: -77.359309, active: true,
    description: 'Montclair Northgate is an active slug pickup location serving the northern Montclair community.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
    fbGroups: [{ name: 'Montclair Sluglines', url: 'https://www.facebook.com/groups/montclairslugs/' }],
  },
  'Old-Hechingers': {
    name: 'Old Hechingers',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.674301, lng: -77.255623, active: true,
    description: 'Old Hechingers (Woodbridge) is an active slug pickup location near the site of the former Hechingers store.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Potomac-Mills': {
    name: 'Potomac Mills',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.640717, lng: -77.293884, active: true,
    description: 'Potomac Mills mall parking has been reduced to 275 spaces around Potomac Mills Circle. Commuters are allowed to park only in spots marked in yellow.',
    peakHours: '6:30 AM – 8:15 AM',
    parking: '275 parking spaces around Potomac Mills Circle (yellow-marked spots only).',
    linesFrom: ['18th Street'],
    linesTo: ['The Pentagon', '15th Street & New York Ave', 'Rosslyn'],
    transit: ['OmniRide'],
  },
  'Route-123': {
    name: 'Route 123',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.6701716, lng: -77.2509748, active: true,
    description: 'Route 123 (Occoquan area) is an active slug pickup location in Prince William County.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Route-234': {
    name: 'Route 234',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.576817, lng: -77.315826, active: true,
    description: 'Route 234 (Manassas area) is an active slug pickup location serving commuters from Prince William County.',
    peakHours: '5:45 AM – 8:00 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Tacketts-Mill': {
    name: 'Tacketts Mill',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.675777, lng: -77.276543, active: true,
    description: "Tacketts Mill is an active slug pickup location in Lake Ridge, Prince William County.",
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Telegraph-Rd': {
    name: 'Telegraph Rd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Prince William',
    lat: 38.658051, lng: -77.288749, active: true,
    description: 'Telegraph Road is an active slug pickup location in Prince William County near Woodbridge.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  },
  'Route-610-Mine-Rd': {
    name: 'Route 610 – Mine Rd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford',
    lat: 38.4669945, lng: -77.4160618, active: true,
    description: 'Route 610 at Mine Road is a slug pickup location in Stafford County.',
    peakHours: '5:30 AM – 7:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza"],
  },
  'Route-610-Staffordboro-Blvd': {
    name: 'Route 610 – Staffordboro Blvd',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford',
    lat: 38.4752647, lng: -77.4129771, active: true,
    description: 'Route 610 at Staffordboro Boulevard is an active slug pickup location in Stafford County.',
    peakHours: '5:30 AM – 7:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza"],
  },
  'Route-630': {
    name: 'Route 630',
    corridor: 'I-395/I-95', direction: 'Morning', county: 'Stafford',
    lat: 38.4212359, lng: -77.4254927, active: true,
    description: 'Route 630 is an active slug pickup location in Stafford County serving I-95 commuters.',
    peakHours: '5:30 AM – 7:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza"],
  },
  'Mark-Center': {
    name: 'Mark Center',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Alexandria',
    lat: 38.8310454, lng: -77.1176246, active: true,
    description: 'Mark Center in Alexandria is a major afternoon slug drop-off and pickup point near the Mark Center BRAC facility.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['Bob's - Old Keene Mill Rd', 'Franconia-Springfield', 'Lorton'],
    fbGroups: [{ name: 'Mark Center Slugs', url: 'https://www.facebook.com/groups/markcenterslugs/' }],
    transit: ['Fairfax Connector', 'DASH Bus'],
  },
  'Tysons-Corner': {
    name: 'Tysons Corner',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Fairfax/Alexandria',
    lat: 38.931906, lng: -77.230132, active: true,
    description: 'Tysons Corner is an afternoon slug pickup location for commuters heading back to Northern Virginia suburbs.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['Fairfax', 'Springfield area'],
  },
  'Crystal-City-12th-St': {
    name: 'Crystal City 12th St',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Arlington',
    lat: 38.8620732, lng: -77.048738, active: true,
    description: 'Crystal City 12th Street is one of two Crystal City slug pickup points for afternoon commuters heading back to Northern Virginia.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['Fairfax', 'Prince William', 'Stafford'],
    fbGroups: [{ name: 'Crystal City Slug Lines', url: 'https://www.facebook.com/groups/crystalcitysluglines/' }],
    transit: ['Metro Blue/Yellow Line - Crystal City station'],
  },
  'Crystal-City-23rd-St': {
    name: 'Crystal City 23rd St',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Arlington',
    lat: 38.85238, lng: -77.04964, active: true,
    description: 'Crystal City 23rd Street is the second Crystal City slug pickup point, serving afternoon commuters.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['Fairfax', 'Prince William', 'Stafford'],
    fbGroups: [{ name: 'Crystal City Slug Lines', url: 'https://www.facebook.com/groups/crystalcitysluglines/' }],
    transit: ['Metro Blue/Yellow Line - Crystal City station'],
  },
  'Rosslyn': {
    name: 'Rosslyn',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Arlington',
    lat: 38.898092, lng: -77.071726, active: true,
    description: 'Rosslyn is a major afternoon slug pickup point in Arlington, serving commuters heading to Northern Virginia via I-66 and I-395.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['All Northern Virginia corridors'],
    fbGroups: [{ name: 'Rosslyn Sluglines', url: 'https://www.facebook.com/groups/rosslynsluglines/' }],
    transit: ['Metro Orange/Silver/Blue Line - Rosslyn station'],
  },
  'The-Pentagon': {
    name: 'The Pentagon',
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Arlington',
    lat: 38.8680768, lng: -77.0524506, active: true,
    description: 'The Pentagon is a major slug pickup and drop-off point, serving both morning and afternoon commuters across both the I-395 and I-66 corridors.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['All Northern Virginia corridors'],
    fbGroups: [{ name: 'Pentagon Sluglines', url: 'https://www.facebook.com/groups/pentagonsluglines/' }],
    transit: ['Metro Yellow/Blue Line - Pentagon station'],
  },
  'LEnfant-Plaza': {
    name: "L'Enfant Plaza",
    corridor: 'I-395/I-95', direction: 'Afternoon', county: 'Washington DC',
    lat: 38.88489, lng: -77.023402, active: true,
    description: "L'Enfant Plaza is a major afternoon slug pickup location in Washington DC, serving commuters heading to Fairfax, Prince William, and Stafford counties.",
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['All Northern Virginia morning spots'],
    fbGroups: [{ name: "L'Enfant Slugs", url: 'https://www.facebook.com/groups/lenfantslugs/' }],
    transit: ["Metro Green/Yellow Line - L'Enfant Plaza station"],
  },
  'Foggy-Bottom': {
    name: 'Foggy Bottom',
    corridor: 'I-66', direction: 'Afternoon', county: 'Washington DC',
    lat: 38.90075, lng: -77.049611, active: true,
    description: 'Foggy Bottom is an afternoon slug pickup location for I-66 commuters heading back to Northern Virginia.',
    peakHours: '3:30 PM – 6:30 PM',
    linesFrom: ['Fairfax', 'Loudoun', 'Prince William (I-66)'],
    transit: ['Metro Orange/Silver/Blue Line - Foggy Bottom station'],
  },
  'Vienna-Metro-South-KnR': {
    name: 'Vienna Metro South KnR',
    corridor: 'I-66', direction: 'Morning', county: 'Fairfax',
    lat: 38.8774069, lng: -77.2706202, active: true,
    description: "Vienna Metro South Kiss-and-Ride is an active I-66 corridor slug pickup location near the Vienna/Fairfax Metro station.",
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
    fbGroups: [{ name: 'Vienna Slugs', url: 'https://www.facebook.com/groups/viennaslugs/' }],
    transit: ['Metro Orange/Silver Line - Vienna station'],
  },
  'Fairfax-Govt': {
    name: 'Fairfax Govt',
    corridor: 'I-66', direction: 'Morning', county: 'Fairfax',
    lat: 38.8542902, lng: -77.3604273, active: true,
    description: 'Fairfax Government Center area slug pickup for I-66 commuters heading into DC.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
  'Stringfellow-PnR': {
    name: 'Stringfellow PnR',
    corridor: 'I-66', direction: 'Morning', county: 'Fairfax',
    lat: 38.854028, lng: -77.404472, active: true,
    description: 'Stringfellow Park-and-Ride is an I-66 corridor slug pickup in Chantilly/Fairfax.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
  'Herndon-Monroe-PnR': {
    name: 'Herndon-Monroe PnR',
    corridor: 'I-66', direction: 'Morning', county: 'Fairfax',
    lat: 38.9513106, lng: -77.3823065, active: true,
    description: 'Herndon-Monroe Park-and-Ride is an active slug pickup for I-66 commuters in the Herndon area.',
    peakHours: '6:00 AM – 8:30 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
  'Cushing-Road': {
    name: 'Cushing Road',
    corridor: 'I-66', direction: 'Morning', county: 'Prince William',
    lat: 38.7950597, lng: -77.563859, active: true,
    description: 'Cushing Road is an I-66 corridor slug pickup location in Gainesville, Prince William County.',
    peakHours: '5:45 AM – 8:00 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
  'East-Gate': {
    name: 'East Gate',
    corridor: 'I-66', direction: 'Morning', county: 'Loudoun',
    lat: 38.9119294, lng: -77.4914467, active: true,
    description: 'East Gate is an I-66 corridor slug pickup in Loudoun County near the Brambleton area.',
    peakHours: '5:45 AM – 8:00 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
  'Stone-Ridge': {
    name: 'Stone Ridge',
    corridor: 'I-66', direction: 'Morning', county: 'Loudoun',
    lat: 38.938222, lng: -77.555917, active: true,
    description: 'Stone Ridge is an I-66 corridor slug pickup in Loudoun County.',
    peakHours: '5:45 AM – 8:00 AM',
    linesFrom: ['Pentagon', 'Rosslyn', "L'Enfant Plaza"],
  },
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const spot = SPOT_DATA[params.slug]
  if (!spot) return { title: 'Location Not Found – Sluglines' }
  return {
    title: `${spot.name} – Sluglines`,
    description: spot.description || `Slug pickup location at ${spot.name} on the ${spot.corridor} corridor.`,
  }
}

export default function SpotPage({ params }: { params: { slug: string } }) {
  const spot = SPOT_DATA[params.slug]
  if (!spot) notFound()

  const mapsUrl = `https://google.com/maps/?q=${spot.lat},${spot.lng}`
  const sluglinesUrl = `https://sluglines.com/slug_pickup/${params.slug}/`
  const corridorColor = spot.corridor.includes('395') ? '#fc8181' : 'var(--accent)'
  const corridorBg = spot.corridor.includes('395') ? 'rgba(248,113,113,0.1)' : 'rgba(99,179,237,0.1)'
  const corridorBorder = spot.corridor.includes('395') ? 'rgba(248,113,113,0.2)' : 'rgba(99,179,237,0.2)'

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Back */}
      <Link href="/spots" className="inline-flex items-center gap-2 text-sm mb-8 hover:text-white transition-colors" style={{ color: 'var(--muted)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to all spots
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: corridorBg, color: corridorColor, border: `1px solid ${corridorBorder}` }}>
            {spot.corridor}
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
            {spot.direction} · {spot.county}
          </span>
          {!spot.active && (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,100,100,0.1)', color: '#fc8181', border: '1px solid rgba(255,100,100,0.2)' }}>
              Inactive
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>{spot.name}</h1>
        {spot.description && <p className="text-lg" style={{ color: 'var(--muted)' }}>{spot.description}</p>}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-10">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'var(--accent)', color: '#0a0f1a' }}>
          <Navigation className="w-4 h-4" /> Open in Google Maps
        </a>
        <a href={sluglinesUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border hover:text-white"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}>
          <ExternalLink className="w-4 h-4" /> View on sluglines.com
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Peak hours */}
        {spot.peakHours && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Peak Hours</h2>
            </div>
            <p className="text-lg font-semibold text-white">{spot.peakHours}</p>
          </div>
        )}

        {/* Parking */}
        {spot.parking && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Parking</h2>
            </div>
            <p style={{ color: 'var(--muted)' }}>{spot.parking}</p>
          </div>
        )}

        {/* Lines from */}
        {spot.linesFrom && spot.linesFrom.length > 0 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Slug Lines From Here</h2>
            </div>
            <ul className="space-y-1.5">
              {spot.linesFrom.map(line => (
                <li key={line} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--green)' }}></span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lines to */}
        {spot.linesTo && spot.linesTo.length > 0 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Slug Lines To Here</h2>
            </div>
            <ul className="space-y-1.5">
              {spot.linesTo.map(line => (
                <li key={line} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#fc8181' }}></span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Facebook Groups */}
        {spot.fbGroups && spot.fbGroups.length > 0 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Facebook className="w-4 h-4" style={{ color: '#4267B2' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Facebook Groups</h2>
            </div>
            <div className="space-y-2">
              {spot.fbGroups.map(g => (
                <a key={g.url} href={g.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-white transition-colors"
                  style={{ color: '#4267B2' }}>
                  <Facebook className="w-4 h-4 shrink-0" />
                  {g.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Transit */}
        {spot.transit && spot.transit.length > 0 && (
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Bus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Public Transit</h2>
            </div>
            <ul className="space-y-1.5">
              {spot.transit.map(t => (
                <li key={t} className="text-sm" style={{ color: 'var(--muted)' }}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Notes */}
      {spot.notes && (
        <div className="mt-6 rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-sm italic" style={{ color: 'var(--muted)' }}>{spot.notes}</p>
        </div>
      )}

      {/* Footer link back to full sluglines.com page */}
      <div className="mt-10 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>For full details, photos, and community discussion about this location:</p>
        <a href={sluglinesUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm hover:text-white transition-colors"
          style={{ color: 'var(--accent)' }}>
          <ExternalLink className="w-4 h-4" />
          View {spot.name} on sluglines.com →
        </a>
      </div>
    </div>
  )
}
