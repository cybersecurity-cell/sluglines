import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdvisoryList } from '@/components/AdvisoryList'
import { VerificationBadge } from '@/components/VerificationBadge'
import { saveLocation } from '@/app/account/actions'
import { getPublicLocation, listPublicAdvisories } from '@/lib/data/public'
import type { AdvisorySummary } from '@/lib/domain/advisory'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const location = await getPublicLocation(slug)
    return location
      ? { title: `${location.name} slugging information | Sluglines`, description: `Review source-labelled pickup and destination information for ${location.name}.` }
      : { title: 'Location not found | Sluglines' }
  } catch {
    return { title: 'Location information | Sluglines' }
  }
}

export default async function LocationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let location
  try {
    location = await getPublicLocation(slug)
  } catch {
    return <div className="mx-auto max-w-3xl px-5 py-20" role="alert"><h1 className="text-3xl font-black">Location information is temporarily unavailable.</h1><p className="mt-4 text-slate-600">Please try again shortly.</p></div>
  }
  if (!location) notFound()

  let advisories: AdvisorySummary[] = []
  let advisoriesUnavailable = false
  try {
    advisories = await listPublicAdvisories(location.id)
  } catch {
    advisoriesUnavailable = true
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20">
      <Link className="text-sm font-bold text-blue-700 hover:underline" href="/locations">← All locations</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{location.corridor}</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">{location.name}</h1><p className="mt-2 text-slate-600">{location.directionLabel}</p></div>
        <VerificationBadge freshness={location.freshness} />
      </div>
      <form action={saveLocation} className="mt-6"><input name="locationId" type="hidden" value={location.id} /><button className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold text-slate-900 hover:bg-slate-100" type="submit">Save to my locations</button></form>

      <section aria-labelledby="details-heading" className="mt-10 grid gap-5 md:grid-cols-2">
        <h2 className="sr-only" id="details-heading">Location details</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold">Pickup area</h3><p className="mt-2 text-sm leading-6 text-slate-600">{location.address ?? location.municipality ?? 'A precise pickup point is not currently verified.'}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold">Destination connections</h3>{location.routes.length ? <ul className="mt-3 space-y-4">{location.routes.map((route) => <li className="border-t border-slate-100 pt-3 first:border-0 first:pt-0" key={`${route.direction}:${route.destinationSlug}`}><p className="font-semibold">{route.destinationName}</p><div className="mt-2"><VerificationBadge freshness={route.freshness} /></div>{route.source ? <a className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline" href={route.source.url} rel="noreferrer" target="_blank">Route source: {route.source.name}</a> : <p className="mt-2 text-xs text-slate-500">No public route source attached.</p>}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-slate-600">No destination is currently listed.</p>}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold">Parking and access</h3><p className="mt-2 text-sm leading-6 text-slate-600">{location.parkingDetails ?? 'Parking details need confirmation.'}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-bold">Operating note</h3><p className="mt-2 text-sm leading-6 text-slate-600">{location.operatingNotes ?? 'Confirm current signs and queue practices at the location.'}</p></div>
      </section>

      <section className="mt-10 rounded-2xl bg-slate-100 p-6" aria-labelledby="source-heading"><h2 className="font-bold" id="source-heading">Source and review context</h2>{location.source ? <p className="mt-2 text-sm text-slate-700">Directory source: <a className="font-semibold text-blue-700 underline" href={location.source.url} rel="noreferrer" target="_blank">{location.source.name}</a></p> : <p className="mt-2 text-sm text-slate-700">No public source link is currently attached.</p>}<p className="mt-2 text-sm text-slate-600">Use the review label above together with observations at the location.</p></section>

      <section className="mt-12" aria-labelledby="advisories-heading"><h2 className="text-2xl font-black" id="advisories-heading">Current advisories</h2><div className="mt-5"><AdvisoryList advisories={advisories} unavailable={advisoriesUnavailable} /></div></section>
    </div>
  )
}
