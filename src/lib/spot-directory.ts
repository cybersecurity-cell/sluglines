import type { LocationCardLocation } from '@/components/LocationCard'

export type SpotCorridor = 'I-395 / I-95' | 'I-66'
export type SpotDirection = 'Morning' | 'Afternoon'

export interface DirectorySpot {
  name: string
  slug: string
  lat: number
  lng: number
  active: boolean
  corridor: SpotCorridor
  direction: SpotDirection
  county: string
  destination: string
  description: string
  peakHours?: string
  parking?: string
  linesFrom?: string[]
  linesTo?: string[]
  fbUrl?: string
  notes?: string
}

export interface CorridorGroup {
  corridor: SpotCorridor
  directions: {
    direction: SpotDirection
    counties: {
      county: string
      spots: DirectorySpot[]
    }[]
  }[]
}

function spot(
  data: Omit<DirectorySpot, 'description' | 'destination'> & {
    destination?: string
    description?: string
  }
): DirectorySpot {
  return {
    destination: data.destination || 'Pentagon, downtown DC, and Northern Virginia commuter destinations',
    description:
      data.description ||
      `${data.name} is a ${data.direction.toLowerCase()} slug line location in ${data.county} serving the ${data.corridor} corridor.`,
    ...data,
  }
}

export const SPOT_DIRECTORY: DirectorySpot[] = [
  spot({
    name: "Bob's - Old Keene Mill Rd",
    slug: 'Bobs-Old-Keene-Mill-Rd',
    lat: 38.7783912,
    lng: -77.1873566,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: "Pentagon, L'Enfant Plaza, and downtown DC",
    peakHours: '5:45 AM - 8:00 AM',
    parking: 'Large commuter parking area around Springfield Plaza and nearby lots.',
    linesFrom: ["L'Enfant Plaza", '14th Street', '18th Street', 'Pentagon'],
    linesTo: ["L'Enfant Plaza", '14th Street', '18th Street', 'Pentagon'],
    fbUrl: 'https://www.facebook.com/groups/springfieldsluglines/',
    description:
      "One of the oldest and best-known Springfield slug lines. Morning riders use Bob's / Old Keene Mill for common Pentagon and downtown DC destinations.",
  }),
  spot({
    name: 'Cardinal Forest Plaza',
    slug: 'cardinal-forest-plaza',
    lat: 38.7794583,
    lng: -77.2314818,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: "Pentagon, L'Enfant Plaza, and 14th Street",
    peakHours: '6:00 AM - 8:30 AM',
    linesFrom: ["L'Enfant Plaza", 'Pentagon', '14th Street'],
  }),
  spot({ name: 'Franconia - Springfield', slug: 'Franconia-Springfield', lat: 38.767306, lng: -77.168972, active: false, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Fairfax' }),
  spot({ name: 'Lorton', slug: 'Lorton', lat: 38.715012, lng: -77.213593, active: false, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Fairfax' }),
  spot({
    name: 'Rolling Valley',
    slug: 'Rolling-Valley',
    lat: 38.7758648,
    lng: -77.2629826,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: "Pentagon, L'Enfant Plaza, and 14th Street",
    peakHours: '6:00 AM - 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
  }),
  spot({ name: 'Saratoga', slug: 'Saratoga', lat: 38.7454983, lng: -77.2100791, active: false, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Fairfax' }),
  spot({ name: 'Sydenstricker Rd', slug: 'Sydenstricker-Rd', lat: 38.755989, lng: -77.238098, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Fairfax', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Route 3 - Gordon Rd', slug: 'Route-3-Gordon-Rd', lat: 38.2895891, lng: -77.5634542, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '5:30 AM - 7:30 AM' }),
  spot({ name: 'Route 17', slug: 'Route-17', lat: 38.3461443, lng: -77.5018604, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '5:30 AM - 7:30 AM' }),
  spot({ name: 'Route 208', slug: 'Route-208', lat: 38.25132, lng: -77.508324, active: false, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg' }),
  spot({ name: 'Dale City', slug: 'Dale-City', lat: 38.646938, lng: -77.341232, active: false, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William' }),
  spot({ name: 'Horner Rd', slug: 'Horner-Rd', lat: 38.658592, lng: -77.280746, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM', linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'] }),
  spot({ name: 'Montclair Fire Station', slug: 'Montclair-Fire-Station', lat: 38.62624, lng: -77.348183, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM', fbUrl: 'https://www.facebook.com/groups/montclairslugs/' }),
  spot({ name: 'Montclair Northgate', slug: 'Montclair-Northgate', lat: 38.6105087, lng: -77.359309, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM', fbUrl: 'https://www.facebook.com/groups/montclairslugs/' }),
  spot({ name: 'Old Hechingers', slug: 'Old-Hechingers', lat: 38.674301, lng: -77.255623, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM' }),
  spot({
    name: 'Potomac Mills',
    slug: 'Potomac-Mills',
    lat: 38.640717,
    lng: -77.293884,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Prince William',
    destination: 'Pentagon, Crystal City, Rosslyn, and DC',
    peakHours: '6:30 AM - 8:15 AM',
    parking: 'Commuter parking around Potomac Mills Circle.',
    linesTo: ['The Pentagon', '15th Street & New York Ave', 'Rosslyn'],
    fbUrl: 'https://www.facebook.com/groups/potomacmillssluglines/',
  }),
  spot({ name: 'Route 123', slug: 'Route-123', lat: 38.6701716, lng: -77.2509748, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Route 234', slug: 'Route-234', lat: 38.576817, lng: -77.315826, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '5:45 AM - 8:00 AM' }),
  spot({ name: 'Tacketts Mill', slug: 'Tacketts-Mill', lat: 38.675777, lng: -77.276543, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Telegraph Rd', slug: 'Telegraph-Rd', lat: 38.658051, lng: -77.288749, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Prince William', destination: "Pentagon, L'Enfant Plaza, and 14th Street", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Route 610 - Mine Rd', slug: 'Route-610-Mine-Rd', lat: 38.4669945, lng: -77.4160618, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg', destination: "Pentagon and L'Enfant Plaza", peakHours: '5:30 AM - 7:30 AM' }),
  spot({ name: 'Route 610 - Staffordboro Blvd', slug: 'Route-610-Staffordboro-Blvd', lat: 38.4752647, lng: -77.4129771, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg', destination: "Pentagon and L'Enfant Plaza", peakHours: '5:30 AM - 7:30 AM' }),
  spot({ name: 'Route 630', slug: 'Route-630', lat: 38.4212359, lng: -77.4254927, active: true, corridor: 'I-395 / I-95', direction: 'Morning', county: 'Stafford / Fredericksburg', destination: "Pentagon and L'Enfant Plaza", peakHours: '5:30 AM - 7:30 AM' }),
  spot({ name: 'Mark Center', slug: 'Mark-Center', lat: 38.8310454, lng: -77.1176246, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Fairfax / Alexandria', destination: 'Springfield, Lorton, and Fairfax-area lines', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/markcenterslugs/' }),
  spot({ name: 'Tysons Corner', slug: 'Tysons-Corner', lat: 38.931906, lng: -77.230132, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Fairfax / Alexandria', destination: 'Fairfax and Springfield-area lines', peakHours: '3:30 PM - 6:30 PM' }),
  spot({ name: 'Crystal City 12th St', slug: 'Crystal-City-12th-St', lat: 38.8620732, lng: -77.048738, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Arlington', destination: 'Fairfax, Prince William, and Stafford', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/crystalcitysluglines/' }),
  spot({ name: 'Crystal City 23rd St', slug: 'Crystal-City-23rd-St', lat: 38.85238, lng: -77.04964, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Arlington', destination: 'Fairfax, Prince William, and Stafford', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/crystalcitysluglines/' }),
  spot({ name: 'Rosslyn', slug: 'Rosslyn', lat: 38.898092, lng: -77.071726, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Arlington', destination: 'Northern Virginia corridors', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/rosslynsluglines/' }),
  spot({ name: 'The Pentagon', slug: 'The-Pentagon', lat: 38.8680768, lng: -77.0524506, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Arlington', destination: 'All Northern Virginia corridors', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/pentagonsluglines/' }),
  spot({ name: '14th St and Constitution Ave', slug: '14th-St-and-Constitution-Ave', lat: 38.889938, lng: -77.032021, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '14th St and G St', slug: '14th-St-and-G-St', lat: 38.8981415, lng: -77.0320751, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '14th St and Independence', slug: '14th-St-and-Independence', lat: 38.88733, lng: -77.032156, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '14th St at Commerce Dept.', slug: '14th-St-at-Commerce-Dept', lat: 38.89462, lng: -77.03207, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '15th St and New York Ave', slug: '15th-St-and-New-York-Ave', lat: 38.8990078, lng: -77.033381, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '19th St and F St', slug: '19th-St-and-F-St', lat: 38.896695, lng: -77.043543, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: '19th St and I St', slug: '19th-St-and-I-St', lat: 38.900711, lng: -77.043549, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: "L'Enfant Plaza", slug: 'LEnfant-Plaza', lat: 38.88489, lng: -77.023402, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Fairfax, Prince William, and Stafford', peakHours: '3:30 PM - 6:30 PM', fbUrl: 'https://www.facebook.com/groups/lenfantslugs/' }),
  spot({ name: 'Navy Yard', slug: 'Navy-Yard', lat: 38.8765811, lng: -77.0014703, active: true, corridor: 'I-395 / I-95', direction: 'Afternoon', county: 'Washington DC', destination: 'Northern Virginia commuter lots' }),
  spot({ name: 'Vienna Metro South KnR', slug: 'Vienna-Metro-South-KnR', lat: 38.8774069, lng: -77.2706202, active: true, corridor: 'I-66', direction: 'Morning', county: 'Fairfax', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '6:00 AM - 8:30 AM', fbUrl: 'https://www.facebook.com/groups/viennaslugs/' }),
  spot({ name: 'Fairfax Govt', slug: 'Fairfax-Govt', lat: 38.8542902, lng: -77.3604273, active: true, corridor: 'I-66', direction: 'Morning', county: 'Fairfax', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Stringfellow PnR', slug: 'Stringfellow-PnR', lat: 38.854028, lng: -77.404472, active: true, corridor: 'I-66', direction: 'Morning', county: 'Fairfax', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Herndon-Monroe PnR', slug: 'Herndon-Monroe-PnR', lat: 38.9513106, lng: -77.3823065, active: true, corridor: 'I-66', direction: 'Morning', county: 'Fairfax', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '6:00 AM - 8:30 AM' }),
  spot({ name: 'Cushing Road', slug: 'Cushing-Road', lat: 38.7950597, lng: -77.563859, active: true, corridor: 'I-66', direction: 'Morning', county: 'Prince William', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '5:45 AM - 8:00 AM' }),
  spot({ name: 'East Gate', slug: 'East-Gate', lat: 38.9119294, lng: -77.4914467, active: true, corridor: 'I-66', direction: 'Morning', county: 'Loudoun', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '5:45 AM - 8:00 AM' }),
  spot({ name: 'Stone Ridge', slug: 'Stone-Ridge', lat: 38.938222, lng: -77.555917, active: true, corridor: 'I-66', direction: 'Morning', county: 'Loudoun', destination: "Pentagon, Rosslyn, and L'Enfant Plaza", peakHours: '5:45 AM - 8:00 AM' }),
  spot({ name: 'Foggy Bottom', slug: 'Foggy-Bottom', lat: 38.90075, lng: -77.049611, active: true, corridor: 'I-66', direction: 'Afternoon', county: 'Washington DC', destination: 'Fairfax, Loudoun, and Prince William I-66 lines', peakHours: '3:30 PM - 6:30 PM' }),
]

export function normalizeDirectorySlug(slug: string) {
  return slug.toLowerCase()
}

export function findSpotBySlug(slug: string) {
  const normalized = normalizeDirectorySlug(slug)

  return SPOT_DIRECTORY.find((spot) => normalizeDirectorySlug(spot.slug) === normalized)
}

export function getSpotDetailHref(spot?: DirectorySpot | null) {
  if (!spot) {
    return '/spots'
  }

  return spot.active ? `/spots/${spot.slug}` : `/slug_pickup/${spot.slug}/`
}

export function getActiveSpotLocations() {
  return SPOT_DIRECTORY.filter((spot) => spot.active)
}

export function groupSpotsByCorridor(spots: DirectorySpot[]): CorridorGroup[] {
  const corridors = Array.from(new Set(spots.map((spot) => spot.corridor)))

  return corridors.map((corridor) => ({
    corridor,
    directions: (['Morning', 'Afternoon'] as const)
      .map((direction) => {
        const directionSpots = spots.filter(
          (spotItem) => spotItem.corridor === corridor && spotItem.direction === direction
        )
        const counties = Array.from(new Set(directionSpots.map((spotItem) => spotItem.county))).map((county) => ({
          county,
          spots: directionSpots.filter((spotItem) => spotItem.county === county),
        }))

        return { direction, counties }
      })
      .filter((group) => group.counties.length > 0),
  }))
}

export function directorySpotToLocationCard(spotItem: DirectorySpot): LocationCardLocation {
  return {
    id: `fallback-${spotItem.slug.toLowerCase()}`,
    spot_name: spotItem.name,
    location: `${spotItem.county} / ${spotItem.corridor}`,
    destination: spotItem.destination,
    last_updated: new Date().toISOString(),
  }
}
