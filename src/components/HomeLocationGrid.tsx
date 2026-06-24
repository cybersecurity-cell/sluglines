'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LocateFixed, MapPin } from 'lucide-react'
import LocationCard, { LocationCardLocation } from '@/components/LocationCard'
import { Coordinates, sortLocationsByNearest } from '@/lib/locations'

interface HomeLocation extends LocationCardLocation {
  slug?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface HomeLocationGridProps {
  locations: HomeLocation[]
}

export default function HomeLocationGrid({ locations }: HomeLocationGridProps) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationStatus('ready')
      },
      () => setLocationStatus('unavailable'),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 }
    )
  }, [])

  const sortedLocations = useMemo(() => {
    if (!coordinates) {
      return locations
    }

    return sortLocationsByNearest(locations, coordinates)
  }, [coordinates, locations])

  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-sky-400/15 bg-slate-900/80 px-5 py-14 text-center">
        <MapPin className="mx-auto mb-4 h-9 w-9 text-slate-500" />
        <h2 className="text-xl font-bold text-white">No active slug line spots</h2>
        <p className="mt-2 text-sm text-slate-400">Check back during peak commute hours.</p>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label mb-3">Live now</p>
          <h2 className="text-3xl font-extrabold text-white">Active slug line spots</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-sky-400/15 bg-slate-900 px-3 py-2 text-xs text-slate-400">
          <LocateFixed className="h-4 w-4 text-sky-300" />
          {locationStatus === 'loading' && 'Finding nearest spot'}
          {locationStatus === 'ready' && 'Nearest spot pinned first'}
          {locationStatus === 'unavailable' && 'Showing active spots'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sortedLocations.map((location, index) => (
          <div key={location.id} className="space-y-2">
            {coordinates && index === 0 && (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                <MapPin className="h-3.5 w-3.5" />
                Nearest to you
              </div>
            )}
            <LocationCard location={location} />
            {location.slug && (
              <Link className="inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200" href={`/spots/${location.slug}`}>
                View spot details
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
