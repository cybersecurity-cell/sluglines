'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, MapPin, RefreshCw } from 'lucide-react'
import LocationCard, { LocationCardLocation } from '@/components/LocationCard'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, getOrCreateDeviceId, isCheckInStale } from '@/lib/checkins'

interface DashboardLocation extends LocationCardLocation {
  slug?: string | null
}

interface DashboardClientProps {
  locations: DashboardLocation[]
}

interface CurrentCheckIn {
  role: 'rider' | 'driver'
  locationId: string
  checkedInAt: string
}

export default function DashboardClient({ locations }: DashboardClientProps) {
  const [currentCheckIn, setCurrentCheckIn] = useState<CurrentCheckIn | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const locationsById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations])
  const checkedInLocation = currentCheckIn ? locationsById.get(currentCheckIn.locationId) : null

  const fetchCurrentCheckIn = useCallback(async () => {
    setIsCheckingStatus(true)
    const deviceId = getOrCreateDeviceId(window.localStorage)

    const [riderResult, driverResult] = await Promise.all([
      supabase
        .from('riders')
        .select('location_id,checked_in_at')
        .eq('device_id', deviceId)
        .maybeSingle(),
      supabase
        .from('drivers')
        .select('location_id,checked_in_at')
        .eq('device_id', deviceId)
        .maybeSingle(),
    ])

    const rider = riderResult.data
    const driver = driverResult.data

    if (driver && !isCheckInStale(driver.checked_in_at)) {
      setCurrentCheckIn({ role: 'driver', locationId: driver.location_id, checkedInAt: driver.checked_in_at })
    } else if (rider && !isCheckInStale(rider.checked_in_at)) {
      setCurrentCheckIn({ role: 'rider', locationId: rider.location_id, checkedInAt: rider.checked_in_at })
    } else {
      setCurrentCheckIn(null)
    }

    setIsCheckingStatus(false)
  }, [supabase])

  useEffect(() => {
    fetchCurrentCheckIn()

    const channel = supabase
      .channel('dashboard_user_checkin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchCurrentCheckIn)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchCurrentCheckIn)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCurrentCheckIn, supabase])

  const checkOut = async () => {
    setIsCheckingOut(true)
    const deviceId = getOrCreateDeviceId(window.localStorage)

    await Promise.all([
      supabase.from('riders').delete().eq('device_id', deviceId),
      supabase.from('drivers').delete().eq('device_id', deviceId),
    ])

    setCurrentCheckIn(null)
    setIsCheckingOut(false)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-400/15 bg-slate-900/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Your check-in</p>
            {isCheckingStatus ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking current status
              </p>
            ) : currentCheckIn && checkedInLocation ? (
              <div className="mt-2">
                <p className="font-bold text-white">
                  Checked in as a {currentCheckIn.role} at {checkedInLocation.spot_name}
                </p>
                <p className="mt-1 text-sm text-slate-400">{formatRelativeTime(currentCheckIn.checkedInAt)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">You are not currently checked in.</p>
            )}
          </div>

          {currentCheckIn && (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-300/15 disabled:opacity-60"
              type="button"
              disabled={isCheckingOut}
              onClick={checkOut}
            >
              <LogOut className="h-4 w-4" />
              {isCheckingOut ? 'Checking out...' : 'Check out'}
            </button>
          )}
        </div>
      </section>

      {locations.length === 0 ? (
        <section className="rounded-2xl border border-sky-400/15 bg-slate-900/80 px-5 py-14 text-center">
          <MapPin className="mx-auto mb-4 h-9 w-9 text-slate-500" />
          <h2 className="text-xl font-bold text-white">No active locations</h2>
          <p className="mt-2 text-sm text-slate-400">Live counts will appear here when locations are active.</p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {locations.map((location) => (
            <LocationCard key={location.id} location={location} compact />
          ))}
        </section>
      )}
    </div>
  )
}
