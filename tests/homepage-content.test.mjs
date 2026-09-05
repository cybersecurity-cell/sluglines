import { strict as assert } from 'node:assert'
import { RESOURCE_MODULES } from '../src/lib/site-content.ts'
import { getActiveSpotLocations } from '../src/lib/spot-directory.ts'

assert.equal(getActiveSpotLocations().length > 20, true)
// No mobile app exists — `/app` renders a legacy WordPress page, not a live product.
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Mobile App'), false)
assert.equal(RESOURCE_MODULES.some((module) => module.href === '/app'), false)
