import { strict as assert } from 'node:assert'
import {
  COMMUNITY_CHANNELS,
  getCommunityChannelsForSpot,
  getPrimaryFacebookUrlForSpot,
} from '../src/lib/community-channels.ts'

assert.equal(COMMUNITY_CHANNELS.length, 20)
assert.equal(COMMUNITY_CHANNELS.every((channel) => channel.platform === 'facebook'), true)
assert.equal(COMMUNITY_CHANNELS.some((channel) => /whatsapp/i.test(channel.name + channel.url)), false)
assert.equal(COMMUNITY_CHANNELS.some((channel) => /\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b/.test(channel.url)), false)

const franconiaChannels = getCommunityChannelsForSpot('Franconia-Springfield')
assert.equal(franconiaChannels.some((channel) => channel.name === 'Franconia-Springfield Metro Slug Lines'), true)
assert.equal(
  getPrimaryFacebookUrlForSpot('Franconia-Springfield'),
  'https://www.facebook.com/groups/fssluglines/'
)

const hornerChannels = getCommunityChannelsForSpot('Horner-Rd')
assert.equal(hornerChannels.some((channel) => channel.name === 'Woodbridge Slug Lines'), true)
assert.equal(hornerChannels.some((channel) => channel.name === 'Sluglines'), true)

const dcChannels = getCommunityChannelsForSpot('LEnfant-Plaza')
assert.equal(dcChannels.some((channel) => channel.name === 'DC Slug Lines'), true)
assert.equal(dcChannels.some((channel) => channel.name === 'Loudoun Sluglines'), false)
