import { strict as assert } from 'node:assert'
import { RESOURCE_MODULES } from '../src/lib/site-content.ts'
import { getActiveSpotLocations } from '../src/lib/spot-directory.ts'

assert.equal(getActiveSpotLocations().length > 20, true)
assert.equal(RESOURCE_MODULES.some((module) => module.title === 'Mobile App'), true)
