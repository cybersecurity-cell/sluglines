'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Car, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/checkins'

interface ActivityFeedProps {
  locationId: string
}

interface FeedItem {
  id: string
  role: 'rider' | 'driver'
  checked_in_at: string
}

export default function ActivityFeed({ locationId }: ActivityFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([])
  const supabase = useMemo(() => createClient(), [])

  const fetchActivity = useCallback(async () => {
    const [ridersResult, driversResult] = await Promise.all([
      supabase
        .from('riders')
        .select('id,checked_in_at')
        .eq('location_id', locationId)
        .order('checked_in_at', { ascending: false })
        .limit(10),
      supabase
        .from('drivers')
        .select('id,checked_in_at')
        .eq('location_id', locationId)
        .order('checked_in_at', { ascending: false })
        .limit(10),
    ])

    const riderItems =
      ridersResult.data?.map((item) => ({
        id: `rider-${item.id}`,
        role: 'rider' as const,
        checked_in_at: item.checked_in_at,
      })) || []
    const driverItems =
      driversResult.data?.map((item) => ({
        id: `driver-${item.id}`,
        role: 'driver' as const,
        checked_in_at: item.checked_in_at,
      })) || []

    setItems(
      [...riderItems, ...driverItems]
        .sort((left, right) => new Date(right.checked_in_at).getTime() - new Date(left.checked_in_at).getTime())
        .slice(0, 10)
    )
  }, [locationId, supabase])

  useEffect(() => {
    fetchActivity()

    const channel = supabase
      .channel(`activity_${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'riders', filter: `location_id=eq.${locationId}` },
        fetchActivity
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `location_id=eq.${locationId}` },
        fetchActivity
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchActivity, locationId, supabase])

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-sky-700" />
        <h2 className="text-lg font-bold text-slate-950">Recent activity</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No check-ins yet at this spot.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm text-slate-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                {item.role === 'driver' ? <Car className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                A {item.role} checked in <span className="text-slate-500">{formatRelativeTime(item.checked_in_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
