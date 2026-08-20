import type { AdvisorySummary } from '@/lib/domain/advisory'

import { AdvisoryCard } from './AdvisoryCard'

export function AdvisoryList({ advisories, unavailable = false }: { advisories: AdvisorySummary[]; unavailable?: boolean }) {
  if (unavailable) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950" role="alert">Advisories are temporarily unavailable. Check local signs and conditions before traveling.</div>
  if (advisories.length === 0) return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h2 className="font-bold">No active advisories are published.</h2><p className="mt-2 text-sm text-slate-600">This is not a guarantee of normal operations; confirm local conditions.</p></div>
  return <div className="grid gap-5">{advisories.map((advisory) => <AdvisoryCard advisory={advisory} key={advisory.id} />)}</div>
}
