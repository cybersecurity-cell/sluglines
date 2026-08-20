import Link from 'next/link'

import type { LocationSummary } from '@/lib/domain/location'

import { VerificationBadge } from './VerificationBadge'

export function LocationCard({ location }: { location: LocationSummary }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>{location.corridor}</span>
        <span aria-hidden="true">·</span>
        <span>{location.directionLabel}</span>
      </div>

      <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
        <Link className="rounded-sm hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href={`/locations/${location.slug}`}>
          {location.name}
        </Link>
      </h2>

      {location.municipality ? <p className="mt-1 text-sm text-slate-600">{location.municipality}</p> : null}

      <div className="mt-4">
        <VerificationBadge freshness={location.freshness} />
      </div>

      <div className="mt-5 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destinations</h3>
        {location.routes.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {location.routes.map((route) => (
              <li className="rounded-lg bg-slate-50 p-2.5 text-sm" key={`${route.direction}:${route.destinationSlug}`}>
                <span className="font-semibold text-slate-900">{route.destinationName}</span>
                <span className="ml-2 text-xs text-slate-600">{route.freshness.label}</span>
                {route.source ? <a className="mt-1 block text-xs text-blue-700 underline underline-offset-2" href={route.source.url} rel="noreferrer" target="_blank">Route source: {route.source.name}</a> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-800">No destination currently listed</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
        <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href={`/locations/${location.slug}`}>
          View location details
        </Link>
        {location.source ? (
          <a className="text-slate-600 underline underline-offset-4 hover:text-slate-950" href={location.source.url} rel="noreferrer" target="_blank">
            Source: {location.source.name}
          </a>
        ) : null}
      </div>
    </article>
  )
}
