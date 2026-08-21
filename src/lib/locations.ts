export interface LocationWithCoordinates {
  id: string
  spot_name: string
  destination: string
  latitude?: number | null
  longitude?: number | null
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export function distanceInMiles(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusMiles = 3958.8
  const latitudeDistance = toRadians(toLatitude - fromLatitude)
  const longitudeDistance = toRadians(toLongitude - fromLongitude)
  const fromLatitudeRadians = toRadians(fromLatitude)
  const toLatitudeRadians = toRadians(toLatitude)

  const haversine =
    Math.sin(latitudeDistance / 2) * Math.sin(latitudeDistance / 2) +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDistance / 2) *
      Math.sin(longitudeDistance / 2)

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function sortLocationsByNearest<T extends LocationWithCoordinates>(locations: T[], coordinates: Coordinates) {
  return [...locations].sort((left, right) => {
    const leftDistance = getLocationDistance(left, coordinates)
    const rightDistance = getLocationDistance(right, coordinates)

    return leftDistance - rightDistance
  })
}

export function getLocationDistance(location: LocationWithCoordinates, coordinates: Coordinates) {
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return Number.POSITIVE_INFINITY
  }

  return distanceInMiles(coordinates.latitude, coordinates.longitude, location.latitude, location.longitude)
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
