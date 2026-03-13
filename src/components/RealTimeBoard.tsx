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

    // Real-time subscription
    const channel = supabase
      .channel('spot_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spot_status' },
        (payload) => {
          console.log('Real-time update:', payload)
          fetchSpots()
        }
      )
      .subscribe()

    // Auto-refresh every 60 seconds as fallback
    const interval = setInterval(fetchSpots, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const getWaitColor = (count: number) => {
    if (count === 0) return 'text-slate-400'
    if (count <= 2) return 'text-green-600'
    if (count <= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getWaitBg = (count: number) => {
    if (count === 0) return 'bg-slate-50'
    if (count <= 2) return 'bg-green-50'
    if (count <= 5) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-slate-600">Loading live data...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm font-medium text-green-700">Live — updates in real time</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          Last updated: {lastRefresh.toLocaleTimeString()}
          <button onClick={fetchSpots} className="ml-2 hover:text-blue-600 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Spots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {spots.map((spot) => (
          <div key={spot.id} className={clsx('card border-2 transition-all hover:shadow-md', 
            spot.drivers_waiting > 0 || spot.riders_waiting > 0 ? 'border-blue-100' : 'border-gray-100'
          )}>
            {/* Spot Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">{spot.spot_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{spot.location}</p>
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  → {spot.destination}
                </span>
              </div>
            </div>

            {/* Driver / Rider Counts */}
            <div className="grid grid-cols-2 gap-3">
              {/* Drivers */}
              <div className={clsx('rounded-xl p-3 text-center', getWaitBg(spot.drivers_waiting))}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Car className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-600">DRIVERS</span>
                </div>
                <div className={clsx('text-3xl font-bold', getWaitColor(spot.drivers_waiting))}>
                  {spot.drivers_waiting}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">waiting</div>
              </div>

              {/* Riders */}
              <div className={clsx('rounded-xl p-3 text-center', getWaitBg(spot.riders_waiting))}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-slate-600">RIDERS</span>
                </div>
                <div className={clsx('text-3xl font-bold', getWaitColor(spot.riders_waiting))}>
                  {spot.riders_waiting}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">waiting</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <UpdateCountButton spotId={spot.id} type="driver" count={spot.drivers_waiting} onUpdate={fetchSpots} />
              <UpdateCountButton spotId={spot.id} type="rider" count={spot.riders_waiting} onUpdate={fetchSpots} />
            </div>
          </div>
        ))}
      </div>

      {spots.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active spots right now</p>
          <p className="text-sm mt-1">Check back during peak commute hours (6-9 AM, 4-7 PM)</p>
        </div>
      )}
    </div>
  )
}

function UpdateCountButton({ spotId, type, count, onUpdate }: {
  spotId: string
  type: 'driver' | 'rider'
  count: number
  onUpdate: () => void
}) {
  const supabase = createClient()
  const field = type === 'driver' ? 'drivers_waiting' : 'riders_waiting'
  const label = type === 'driver' ? 'I am Driving' : 'I am Riding'
  const color = type === 'driver' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'

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
      className={`flex-1 text-xs font-semibold text-white py-2 px-3 rounded-lg transition-colors ${color}`}
    >
      + {label}
    </button>
  )
}
