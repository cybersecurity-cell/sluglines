import { strict as assert } from 'node:assert'
import { PRIMARY_NAV, RESOURCE_MODULES } from '../src/lib/site-content.ts'

assert.deepEqual(PRIMARY_NAV.map((item) => item.label), [
  'Slug Pickup',
  'App',
  'Forum',
  'Blog',
  'News',
  'Rules',
])

assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Lost & Found'), true)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Forum'), true)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Blog & News'), true)
