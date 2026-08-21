'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Car, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateDeviceId, normalizeSeatCount } from '@/lib/checkins'

const DESTINATIONS = ['Pentagon', 'Crystal City', "L'Enfant Plaza", 'DC'] as const

type CheckInRole = 'rider' | 'driver'

interface CheckInProps {
  locationId: string
  locationName: string
  role: CheckInRole | null
  isOpen: boolean
  onClose: () => void
  onCheckIn?: () => void
}

export default function CheckIn({
  locationId,
  locationName,
  role,
  isOpen,
  onClose,
  onCheckIn,
}: CheckInProps) {
  const [destination, setDestination] = useState<(typeof DESTINATIONS)[number]>('Pentagon')
  const [seatsAvailable, setSeatsAvailable] = useState('2')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!isOpen) {
      setError(null)
    }
  }, [isOpen])

  if (!isOpen || !role) {
    return null
  }

  const isDriver = role === 'driver'
  const title = isDriver ? 'Check in as Driver' : 'Check in as Rider'

  const cleanStaleCheckIns = async () => {
    const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    await Promise.all([
      supabase.from('riders').delete().lt('checked_in_at', staleBefore),
      supabase.from('drivers').delete().lt('checked_in_at', staleBefore),
    ])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const deviceId = getOrCreateDeviceId(window.localStorage)
      const checkedInAt = new Date().toISOString()

      await cleanStaleCheckIns()

      if (isDriver) {
        await supabase.from('riders').delete().eq('device_id', deviceId)
        const { error: upsertError } = await supabase.from('drivers').upsert(
          {
            location_id: locationId,
            device_id: deviceId,
            destination,
            seats_available: normalizeSeatCount(seatsAvailable),
            checked_in_at: checkedInAt,
          },
          { onConflict: 'device_id' }
        )

        if (upsertError) {
          throw upsertError
        }
      } else {
        await supabase.from('drivers').delete().eq('device_id', deviceId)
        const { error: upsertError } = await supabase.from('riders').upsert(
          {
            location_id: locationId,
            device_id: deviceId,
            destination,
            checked_in_at: checkedInAt,
          },
          { onConflict: 'device_id' }
        )

        if (upsertError) {
          throw upsertError
        }
      }

      onCheckIn?.()
      onClose()
    } catch {
      setError('Could not check you in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-3 pb-3 backdrop-blur-sm sm:items-center sm:p-6">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close check-in" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-t-2xl border border-sky-400/20 bg-slate-950 p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
              {isDriver ? <Car className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{locationName}</p>
          </div>
          <button
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-semibold text-slate-200">Destination</span>
          <select
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white outline-none transition-colors focus:border-sky-400"
            value={destination}
            onChange={(event) => setDestination(event.target.value as (typeof DESTINATIONS)[number])}
          >
            {DESTINATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        {isDriver && (
          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Seats available</span>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white outline-none transition-colors focus:border-sky-400"
              min={1}
              max={3}
              type="number"
              value={seatsAvailable}
              onChange={(event) => setSeatsAvailable(event.target.value)}
            />
          </label>
        )}

        {error && <p className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 font-bold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Checking in...' : title}
        </button>
      </form>
    </div>
  )
}
