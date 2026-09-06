import { strict as assert } from 'node:assert'
import { PRIMARY_NAV, RESOURCE_MODULES } from '../src/lib/site-content.ts'

// The WordPress IA plus the Board (issue #135): §10's one zone that had no
// entry anywhere. `Slug Pickup` is the Spots zone under the community's name.
assert.deepEqual(PRIMARY_NAV.map((item) => item.label), [
  'Slug Pickup',
  'Board',
  'App',
  'Blog',
  'News',
  'Rules',
])
assert.equal(PRIMARY_NAV.find((item) => item.label === 'Board')?.href, '/board')
assert.equal(PRIMARY_NAV.find((item) => item.label === 'Slug Pickup')?.href, '/slug_pickup')

assert.equal(PRIMARY_NAV.some((item) => item.href.startsWith('/forum')), false)
assert.equal(RESOURCE_MODULES.some((module) => module.href.startsWith('/forum')), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Lost & Found'), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Forum'), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Blog & News'), true)
