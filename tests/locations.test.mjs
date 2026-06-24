import { strict as assert } from 'node:assert'
import { distanceInMiles, sortLocationsByNearest } from '../src/lib/locations.ts'

const pentagon = { id: '1', spot_name: 'Pentagon', destination: 'DC', latitude: 38.8681, longitude: -77.0524 }
const horner = { id: '2', spot_name: 'Horner Road', destination: 'Pentagon', latitude: 38.6586, longitude: -77.2807 }
const unknown = { id: '3', spot_name: 'Mystery', destination: 'DC', latitude: null, longitude: null }

assert.equal(Math.round(distanceInMiles(38.8681, -77.0524, 38.8681, -77.0524)), 0)

const sorted = sortLocationsByNearest([horner, unknown, pentagon], {
  latitude: 38.87,
  longitude: -77.05,
})

assert.deepEqual(sorted.map((location) => location.spot_name), ['Pentagon', 'Horner Road', 'Mystery'])
