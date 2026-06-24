'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, Clock, RefreshCw, Users } from 'lucide-react'
import CheckIn from '@/components/CheckIn'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/checkins'

export interface LocationCardLocation {
  id: string
  spot_name: string
  location?: string
  destination: string
  last_updated?: string
}

interface LocationCardProps {
  location: LocationCardLocation
  compact?: boolean
}

type CheckInRole = 'rider' | 'driver'

export default function LocationCard({ location, compact = false }: LocationCardProps) {
  const [riderCount, setRiderCount] = useState(0)
  const [driverCount, setDriverCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(location.last_updated || new Date().toISOString())
  const [isLoading, setIsLoading] = useState(true)
  const [activeRole, setActiveRole] = useState<CheckInRole | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const isFallbackLocation = location.id.startsWith('fallback-')

  const fetchCounts = useCallback(async () => {
    if (isFallbackLocation) {
      setRiderCount(0)
      setDriverCount(0)
      setLastUpdated(new Date().toISOString())
      setIsLoading(false)
      return
    }

    const freshSince = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const [ridersResult, driversResult] = await Promise.all([
      supabase
        .from('riders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', location.id)
        .gt('checked_in_at', freshSince),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', location.id)
        .gt('checked_in_at', freshSince),
    ])

    setRiderCount(ridersResult.count || 0)
    setDriverCount(driversResult.count || 0)
    setLastUpdated(new Date().toISOString())
    setIsLoading(false)
  }, [isFallbackLocation, location.id, supabase])

  useEffect(() => {
    fetchCounts()

    if (isFallbackLocation) {
      return
    }

    const channel = supabase
      .channel(`location_counts_${location.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'riders', filter: `location_id=eq.${location.id}` },
        fetchCounts
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `location_id=eq.${location.id}` },
        fetchCounts
      )
      .subscribe()

    const interval = window.setInterval(fetchCounts, 60000)

    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(interval)
    }
  }, [fetchCounts, isFallbackLocation, location.id, supabase])

  return (
    <article className="rounded-2xl border border-sky-400/15 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/20 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white">{location.spot_name}</h3>
          <p className="mt-1 text-sm text-slate-400">{location.spot_name} → {location.destination}</p>
          {location.location && !compact && <p className="mt-1 text-xs text-slate-500">{location.location}</p>}
        </div>
        <button
          className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          type="button"
          aria-label="Refresh counts"
          onClick={fetchCounts}
        >
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CountPanel count={riderCount} label="Riders" icon={<Users className="h-4 w-4" />} tone="green" />
        <CountPanel count={driverCount} label="Drivers" icon={<Car className="h-4 w-4" />} tone="sky" />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        <span>Updated {formatRelativeTime(lastUpdated)}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-sm font-bold text-emerald-200 transition-colors hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={isFallbackLocation}
          onClick={() => setActiveRole('rider')}
        >
          <Users className="h-4 w-4" />
          Check In as Rider
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-xl border border-sky-300/25 bg-sky-300/10 px-3 py-3 text-sm font-bold text-sky-200 transition-colors hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={isFallbackLocation}
          onClick={() => setActiveRole('driver')}
        >
          <Car className="h-4 w-4" />
          Check In as Driver
        </button>
      </div>

      <CheckIn
        isOpen={activeRole !== null}
        locationId={location.id}
        locationName={location.spot_name}
        role={activeRole}
        onCheckIn={fetchCounts}
        onClose={() => setActiveRole(null)}
      />
    </article>
  )
}

function CountPanel({
  count,
  label,
  icon,
  tone,
}: {
  count: number
  label: string
  icon: React.ReactNode
  tone: 'green' | 'sky'
}) {
  const toneClasses =
    tone === 'green'
      ? 'border-emerald-300/15 bg-emerald-300/5 text-emerald-200'
      : 'border-sky-300/15 bg-sky-300/5 text-sky-200'

  return (
    <div className={`rounded-xl border p-4 text-center ${toneClasses}`}>
      <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-5xl font-extrabold leading-none text-white">{count}</div>
      <div className="mt-1 text-xs text-slate-400">checked in</div>
    </div>
  )
}
