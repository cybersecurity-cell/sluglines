export const CHECK_IN_STALE_AFTER_MS = 2 * 60 * 60 * 1000

export function isCheckInStale(checkedInAt: string, now = new Date()) {
  const checkedInTime = new Date(checkedInAt).getTime()

  if (Number.isNaN(checkedInTime)) {
    return true
  }

  return now.getTime() - checkedInTime > CHECK_IN_STALE_AFTER_MS
}

export function normalizeSeatCount(value: string | number) {
  const seats = typeof value === 'number' ? value : Number.parseInt(value, 10)

  if (Number.isNaN(seats)) {
    return 1
  }

  return Math.min(3, Math.max(1, seats))
}

export function formatRelativeTime(value: string, now = new Date()) {
  const time = new Date(value).getTime()

  if (Number.isNaN(time)) {
    return 'just now'
  }

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - time) / 1000))
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`
  }

  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`
  }

  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
}

export function getOrCreateDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const existing = storage.getItem('sluglines_device_id')

  if (existing) {
    return existing
  }

  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`

  storage.setItem('sluglines_device_id', created)
  return created
}
