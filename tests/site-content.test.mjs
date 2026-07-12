import { strict as assert } from 'node:assert'
import { PRIMARY_NAV, RESOURCE_MODULES } from '../src/lib/site-content.ts'

assert.deepEqual(PRIMARY_NAV.map((item) => item.label), [
  'Slug Pickup',
  'App',
  'Blog',
  'News',
  'Rules',
])

assert.equal(PRIMARY_NAV.some((item) => item.href.startsWith('/forum')), false)
assert.equal(RESOURCE_MODULES.some((module) => module.href.startsWith('/forum')), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Lost & Found'), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Forum'), false)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Blog & News'), true)
