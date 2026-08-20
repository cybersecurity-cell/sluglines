import type { FreshnessPresentation } from '@/lib/domain/location'

const toneClasses: Record<FreshnessPresentation['tone'], string> = {
  verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  community: 'bg-sky-50 text-sky-800 ring-sky-200',
  review: 'bg-amber-50 text-amber-900 ring-amber-200',
  historical: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function VerificationBadge({ freshness }: { freshness: FreshnessPresentation }) {
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClasses[freshness.tone]}`}
    >
      <span>{freshness.label}</span>
      <span aria-hidden="true">·</span>
      <span className="font-normal">{freshness.detail}</span>
    </span>
  )
}
