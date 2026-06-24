'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Siren, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/checkins'

type AlertType = 'info' | 'warning' | 'urgent'

interface CommunityAlert {
  id: string
  message: string
  type: AlertType
  created_at: string
}

interface AlertBannerProps {
  locationId: string
}

const TYPE_STYLES: Record<AlertType, string> = {
  info: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
  warning: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  urgent: 'border-red-300/30 bg-red-300/10 text-red-200',
}

export default function AlertBanner({ locationId }: AlertBannerProps) {
  const [alerts, setAlerts] = useState<CommunityAlert[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('alerts')
      .select('id,message,type,created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(3)

    if (data) {
      setAlerts(data as CommunityAlert[])
    }
  }, [locationId, supabase])

  useEffect(() => {
    fetchAlerts()

    const channel = supabase
      .channel(`alerts_${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `location_id=eq.${locationId}` },
        fetchAlerts
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAlerts, locationId, supabase])

  const visibleAlerts = alerts.filter((alert) => !dismissedIds.has(alert.id)).slice(0, 3)

  if (visibleAlerts.length === 0) {
    return null
  }

  return (
    <section className="space-y-3" aria-label="Community alerts">
      {visibleAlerts.map((alert) => (
        <div key={alert.id} className={`rounded-xl border p-4 ${TYPE_STYLES[alert.type]}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${TYPE_STYLES[alert.type]}`}>
                  {alert.type}
                </span>
                <span className="text-xs text-slate-400">{formatRelativeTime(alert.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-white">{alert.message}</p>
            </div>
            <button
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              type="button"
              aria-label="Dismiss alert"
              onClick={() => setDismissedIds((current) => new Set(current).add(alert.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}

function getAlertIcon(type: AlertType) {
  if (type === 'urgent') {
    return <Siren className="h-5 w-5" />
  }

  if (type === 'warning') {
    return <AlertTriangle className="h-5 w-5" />
  }

  return <Info className="h-5 w-5" />
}
