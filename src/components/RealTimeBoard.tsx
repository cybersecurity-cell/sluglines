'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Car, Users, RefreshCw, Clock } from 'lucide-react'
import clsx from 'clsx'

interface SpotStatus {
  id: string
  spot_name: string
  location: string
  destination: string
  drivers_waiting: number
  riders_waiting: number
  last_updated: string
  is_active: boolean
}

export default function RealTimeBoard() {
  const [spots, setSpots] = useState<SpotStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const supabase = createClient()

  const fetchSpots = async () => {
    const { data, error } = await supabase
      .from('spot_status')
      .select('*')
      .eq('is_active', true)
      .order('spot_name', { ascending: true })
    if (!error && data) {
      setSpots(data)
      setLastRefresh(new Date())
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSpots()
    const channel = supabase
      .channel('spot_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_status' }, () => {
        fetchSpots()
      })
      .subscribe()
    const interval = setInterval(fetchSpots, 60000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const getCountColor = (count: number) => {
    if (count === 0) return { color: 'var(--muted)' }
    if (count <= 2) return { color: 'var(--green)' }
    if (count <= 5) return { color: '#fbbf24' }
    return { color: 'var(--red)' }
  }

  const getCardBorder = (spot: SpotStatus) => {
    const total = spot.drivers_waiting + spot.riders_waiting
    if (total === 0) return 'var(--border)'
    if (total <= 4) return 'rgba(99,179,237,0.25)'
    return 'rgba(251,191,36,0.25)'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--muted)' }}>Loading live data...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <span className="live-dot"></span>
          <span className="text-sm font-medium" style={{ color: 'var(--green)' }}>
            Live â updates in real time
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <Clock className="w-3.5 h-3.5" />
          {lastRefresh.toLocaleTimeString()}
          <button onClick={fetchSpots} className="ml-1 hover:text-white transition-colors" title="Refresh now">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {spots.map((spot) => (
          <div
            key={spot.id}
            className="rounded-2xl border p-5 transition-all"
            style={{ background: 'var(--surface)', borderColor: getCardBorder(spot) }}
          >
            <div className="mb-4">
              <h3 className="font-bold text-white text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
                {spot.spot_name}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{spot.location}</p>
              <span
                className="inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(99,179,237,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,179,237,0.2)' }}
              >
                â {spot.destination}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Car className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Drivers</span>
                </div>
                <div className="text-4xl font-bold" style={{ ...getCountColor(spot.drivers_waiting), fontFamily: 'Syne, sans-serif' }}>
                  {spot.drivers_waiting}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>waiting</div>
              </div>

              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Riders</span>
                </div>
                <div className="text-4xl font-bold" style={{ ...getCountColor(spot.riders_waiting), fontFamily: 'Syne, sans-serif' }}>
                  {spot.riders_waiting}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>waiting</div>
              </div>
            </div>

            <div className="flex gap-2">
              <UpdateCountButton spotId={spot.id} type="driver" count={spot.drivers_waiting} onUpdate={fetchSpots} />
              <UpdateCountButton spotId={spot.id} type="rider" count={spot.riders_waiting} onUpdate={fetchSpots} />
            </div>
          </div>
        ))}
      </div>

      {spots.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-10 h-10 mx-auto mb-4 opacity-20" style={{ color: 'var(--muted)' }} />
          <p className="font-semibold text-white">No active spots right now</p>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Check back during peak hours: 6â9 AM and 4â7 PM weekdays
          </p>
        </div>
      )}
    </div>
  )
}

function UpdateCountButton({
  spotId, type, count, onUpdate,
}: {
  spotId: string
  type: 'driver' | 'rider'
  count: number
  onUpdate: () => void
}) {
  const supabase = createClient()
  const field = type === 'driver' ? 'drivers_waiting' : 'riders_waiting'
  const label = type === 'driver' ? 'I am Driving' : 'I am Riding'
  const isDriver = type === 'driver'

  const handleClick = async () => {
    await supabase
      .from('spot_status')
      .update({ [field]: count + 1, last_updated: new Date().toISOString() })
      .eq('id', spotId)
    onUpdate()
  }

  return (
    <button
      onClick={handleClick}
      className={clsx('flex-1 text-xs font-semibold py-2.5 px-3 rounded-lg transition-all', isDriver ? 'text-white' : 'text-white')}
      style={
        isDriver
          ? { background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--accent)' }
          : { background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.25)', color: 'var(--green)' }
      }
    >
      + {label}
    </button>
  )
}
