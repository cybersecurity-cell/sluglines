export type CommunityChannelPlatform = 'facebook'

export interface CommunityChannel {
  name: string
  url: string
  platform: CommunityChannelPlatform
  spotSlugs: string[]
  description?: string
}

const DC_RETURN_SPOTS = [
  '14th-St-and-Constitution-Ave',
  '14th-St-and-G-St',
  '14th-St-and-Independence',
  '14th-St-at-Commerce-Dept',
  '15th-St-and-New-York-Ave',
  '19th-St-and-F-St',
  '19th-St-and-I-St',
  'LEnfant-Plaza',
  'Navy-Yard',
]

const SPRINGFIELD_SPOTS = [
  'Bobs-Old-Keene-Mill-Rd',
  'Cardinal-Forest-Plaza',
  'Franconia-Springfield',
  'Rolling-Valley',
  'Saratoga',
  'Sydenstricker-Rd',
]

const WOODBRIDGE_SPOTS = [
  'Dale-City',
  'Horner-Rd',
  'Old-Hechingers',
  'Potomac-Mills',
  'Route-123',
  'Route-234',
  'Tacketts-Mill',
  'Telegraph-Rd',
]

const STAFFORD_SPOTS = [
  'Route-3-Gordon-Rd',
  'Route-17',
  'Route-208',
  'Route-610-Mine-Rd',
  'Route-610-Staffordboro-Blvd',
  'Route-630',
]

const I66_SPOTS = [
  'Vienna-Metro-South-KnR',
  'Fairfax-Govt',
  'Stringfellow-PnR',
  'Herndon-Monroe-PnR',
  'Cushing-Road',
  'East-Gate',
  'Stone-Ridge',
  'Foggy-Bottom',
]

export const COMMUNITY_CHANNELS: CommunityChannel[] = [
  channel('Woodbridge Slug Lines', 'https://www.facebook.com/groups/woodbridgesluglines/', WOODBRIDGE_SPOTS),
  channel('I-66 Slug Lines', 'https://www.facebook.com/groups/I66Sluglines/', I66_SPOTS),
  channel('Sluglines', 'https://www.facebook.com/groups/sluglines/', [...SPRINGFIELD_SPOTS, ...WOODBRIDGE_SPOTS, ...STAFFORD_SPOTS, ...DC_RETURN_SPOTS, ...I66_SPOTS]),
  channel('Herndon Slug Lines', 'https://www.facebook.com/groups/HerndonSlugLines/', ['Herndon-Monroe-PnR']),
  channel('Springfield Slug Lines', 'https://www.facebook.com/groups/springfieldsluglines/', SPRINGFIELD_SPOTS),
  channel('Stafford SlugLines', 'https://www.facebook.com/groups/StaffordSluglines/', STAFFORD_SPOTS),
  channel('StaffordSlugLines', 'https://www.facebook.com/groups/1935445413138327/', STAFFORD_SPOTS),
  channel('Loudoun Sluglines', 'https://www.facebook.com/groups/LoudounSlugLines/', ['East-Gate', 'Stone-Ridge']),
  channel('Pentagon Slug Lines', 'https://www.facebook.com/groups/PentagonSlugLines/', ['The-Pentagon']),
  channel('Tysons Slug Lines', 'https://www.facebook.com/groups/tysonssluglines/', ['Tysons-Corner']),
  channel('Franconia-Springfield Metro Slug Lines', 'https://www.facebook.com/groups/fssluglines/', ['Franconia-Springfield']),
  channel('Centreville SlugLines', 'https://www.facebook.com/groups/CentrevilleSlugLines/', ['Stringfellow-PnR', 'Fairfax-Govt']),
  channel('Mark Center Slug Lines', 'https://www.facebook.com/groups/markcentersluglines/', ['Mark-Center']),
  channel('DC Slug Lines', 'https://www.facebook.com/groups/dcsluglines/', [...DC_RETURN_SPOTS, 'Foggy-Bottom']),
  channel('Gainesville Slug Lines', 'https://www.facebook.com/groups/GainesvilleSlugLines/', ['Cushing-Road']),
  channel('CrystalCity Slug Lines', 'https://www.facebook.com/groups/CrystalCitySluglines/', ['Crystal-City-12th-St', 'Crystal-City-23rd-St']),
  channel('VDOT Fredericksburg District', 'https://www.facebook.com/groups/vdotfredericksburg/', STAFFORD_SPOTS),
  channel('South Riding Carpool', 'https://www.facebook.com/groups/1988475184700925/', ['East-Gate', 'Stone-Ridge']),
  channel('Rosslyn Slug Lines', 'https://www.facebook.com/groups/RosslynSlugLines/', ['Rosslyn']),
  channel('Metropocalypse', 'https://www.facebook.com/groups/Metropocalypse/', [...DC_RETURN_SPOTS, 'Rosslyn', 'Crystal-City-12th-St', 'Crystal-City-23rd-St']),
]

export function getCommunityChannelsForSpot(spotSlug?: string | null) {
  if (!spotSlug) {
    return []
  }

  const normalizedSlug = normalizeSlug(spotSlug)

  return COMMUNITY_CHANNELS.filter((channelItem) =>
    channelItem.spotSlugs.some((slug) => normalizeSlug(slug) === normalizedSlug)
  )
}

export function getPrimaryFacebookUrlForSpot(spotSlug?: string | null) {
  return [...getCommunityChannelsForSpot(spotSlug)].sort(
    (left, right) => left.spotSlugs.length - right.spotSlugs.length
  )[0]?.url
}

function channel(name: string, url: string, spotSlugs: string[]): CommunityChannel {
  return {
    name,
    url,
    platform: 'facebook',
    spotSlugs,
    description: 'Public Facebook community group',
  }
}

function normalizeSlug(slug: string) {
  return slug.toLowerCase()
}
