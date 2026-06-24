export interface DirectorySpot {
  name: string
  slug: string
  lat: number
  lng: number
  active: boolean
  corridor: string
  direction: 'Morning' | 'Afternoon'
  county: string
  destination: string
  description: string
  peakHours?: string
  parking?: string
  linesFrom?: string[]
  linesTo?: string[]
  fbUrl?: string
}

export const SPOT_DIRECTORY: DirectorySpot[] = [
  {
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
  },
  {
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
    description: 'A Fairfax/Springfield morning pickup location serving major DC and Pentagon destinations.',
  },
  {
    name: 'Franconia - Springfield',
    slug: 'Franconia-Springfield',
    lat: 38.767306,
    lng: -77.168972,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: 'Pentagon and DC',
    description: 'A known Franconia-Springfield slug location that is currently listed as inactive.',
  },
  {
    name: 'Lorton',
    slug: 'Lorton',
    lat: 38.715012,
    lng: -77.213593,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: 'Pentagon and DC',
    description: 'A known Lorton slug location that is currently listed as inactive.',
  },
  {
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
    description: 'An active Burke/Springfield area morning pickup location for DC-bound commuters.',
  },
  {
    name: 'Saratoga',
    slug: 'Saratoga',
    lat: 38.7454983,
    lng: -77.2100791,
    active: false,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: 'Pentagon and DC',
    description: 'A known Saratoga slug location that is currently listed as inactive.',
  },
  {
    name: 'Sydenstricker Rd',
    slug: 'Sydenstricker-Rd',
    lat: 38.755989,
    lng: -77.238098,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Fairfax',
    destination: "Pentagon, L'Enfant Plaza, and 14th Street",
    peakHours: '6:00 AM - 8:30 AM',
    description: 'An active Fairfax County morning pickup location for DC and Pentagon commuters.',
  },
  {
    name: 'Horner Rd',
    slug: 'Horner-Rd',
    lat: 38.658592,
    lng: -77.280746,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Morning',
    county: 'Prince William',
    destination: "Pentagon, L'Enfant Plaza, and 14th Street",
    peakHours: '6:00 AM - 8:30 AM',
    linesFrom: ['Pentagon', "L'Enfant Plaza", '14th Street'],
    description: 'A major Prince William County morning slug pickup location for commuters heading north.',
  },
  {
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
    description: 'A heavily used Woodbridge-area pickup location serving Pentagon, Crystal City, Rosslyn, and DC destinations.',
  },
  {
    name: 'Crystal City 23rd St',
    slug: 'Crystal-City-23rd-St',
    lat: 38.85238,
    lng: -77.04964,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Afternoon',
    county: 'Arlington',
    destination: 'Fairfax, Prince William, and Stafford',
    peakHours: '3:30 PM - 6:30 PM',
    fbUrl: 'https://www.facebook.com/groups/crystalcitysluglines/',
    description: 'An afternoon Crystal City pickup point for commuters heading back to Northern Virginia.',
  },
  {
    name: 'Rosslyn',
    slug: 'Rosslyn',
    lat: 38.898092,
    lng: -77.071726,
    active: true,
    corridor: 'I-66 / I-395',
    direction: 'Afternoon',
    county: 'Arlington',
    destination: 'Northern Virginia corridors',
    peakHours: '3:30 PM - 6:30 PM',
    fbUrl: 'https://www.facebook.com/groups/rosslynsluglines/',
    description: 'A major afternoon pickup point in Arlington for riders heading back to Northern Virginia.',
  },
  {
    name: "L'Enfant Plaza",
    slug: 'LEnfant-Plaza',
    lat: 38.88489,
    lng: -77.023402,
    active: true,
    corridor: 'I-395 / I-95',
    direction: 'Afternoon',
    county: 'Washington DC',
    destination: 'Fairfax, Prince William, and Stafford',
    peakHours: '3:30 PM - 6:30 PM',
    fbUrl: 'https://www.facebook.com/groups/lenfantslugs/',
    description: "A central downtown DC afternoon pickup location for commuters returning to Northern Virginia.",
  },
]

export function normalizeDirectorySlug(slug: string) {
  return slug.toLowerCase()
}

export function findSpotBySlug(slug: string) {
  const normalized = normalizeDirectorySlug(slug)

  return SPOT_DIRECTORY.find((spot) => normalizeDirectorySlug(spot.slug) === normalized)
}

export function getActiveSpotLocations() {
  return SPOT_DIRECTORY.filter((spot) => spot.active)
}
