import Link from 'next/link'

import type { AdvisorySummary } from '@/lib/domain/advisory'

import { VerificationBadge } from './VerificationBadge'

const severityLabels: Record<AdvisorySummary['severity'], string> = {
  info: 'Information',
  warning: 'Warning',
  urgent: 'Urgent',
}

const severityClasses: Record<AdvisorySummary['severity'], string> = {
  info: 'bg-blue-50 text-blue-800',
  warning: 'bg-amber-50 text-amber-900',
  urgent: 'bg-red-50 text-red-800',
}

export function AdvisoryCard({ advisory }: { advisory: AdvisorySummary }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${severityClasses[advisory.severity]}`}>
          {severityLabels[advisory.severity]}
        </span>
        {advisory.location ? (
          <Link className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline" href={`/locations/${advisory.location.slug}`}>
            {advisory.location.name}
          </Link>
        ) : (
          <span className="text-sm text-slate-600">All locations</span>
        )}
      </div>

      <h2 className="mt-3 text-lg font-bold text-slate-950">{advisory.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{advisory.message}</p>

      <div className="mt-4">
        <VerificationBadge freshness={advisory.freshness} />
      </div>

      {advisory.source ? (
        <p className="mt-4 text-sm text-slate-600">
          <a className="underline underline-offset-4 hover:text-slate-950" href={advisory.source.url} rel="noreferrer" target="_blank">
            Source: {advisory.source.name}
          </a>
        </p>
      ) : null}
    </article>
  )
}
