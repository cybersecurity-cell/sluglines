import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/auth/actions'
import { PreferencesForm } from '@/components/account/PreferencesForm'
import { ProfileForm } from '@/components/account/ProfileForm'
import { SavedLocations } from '@/components/account/SavedLocations'
import { createClient } from '@/lib/supabase/server'

import { removeSavedLocation, updatePreferences, updateProfile } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your account | Sluglines', robots: { index: false, follow: false } }

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/auth/sign-in?next=%2Faccount')

  const [profileResult, preferencesResult, locationsResult, destinationsResult, savedResult, reportsResult] = await Promise.all([
    client.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    client.from('commute_preferences').select('home_location_id,destination_id,preferred_direction,email_advisories').eq('user_id', user.id).maybeSingle(),
    client.from('locations').select('id,name').eq('published', true).order('name'),
    client.from('destinations').select('id,name').eq('published', true).order('name'),
    client.from('saved_locations').select('location:locations(id,name,slug)').eq('user_id', user.id),
    client.from('correction_reports').select('id,summary,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  const preference = preferencesResult.data
  const results = [profileResult, preferencesResult, locationsResult, destinationsResult, savedResult, reportsResult]
  const accountDataUnavailable = results.some((result) => Boolean(result.error))
  const saved = (savedResult.data ?? []).flatMap((row) => {
    const location = row.location as unknown as { id: string; name: string; slug: string } | null
    return location ? [location] : []
  })

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Private account</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Your Sluglines</h1>
          <p className="mt-3 text-slate-600">Signed in as {user.email}</p>
        </div>
        <form action={signOut}><button className="min-h-11 rounded-xl border border-slate-300 px-5 font-bold hover:bg-slate-100" type="submit">Sign out</button></form>
      </div>

      {message ? <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{message.slice(0, 200)}</p> : null}
      {accountDataUnavailable ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">Some account information is temporarily unavailable. Saving is disabled until the page loads completely.</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ProfileForm action={updateProfile} displayName={profileResult.data?.display_name ?? ''} />
          <PreferencesForm
            action={updatePreferences}
            destinations={destinationsResult.data ?? []}
            locations={locationsResult.data ?? []}
            value={{
              homeLocationId: preference?.home_location_id ?? null,
              destinationId: preference?.destination_id ?? null,
              preferredDirection: preference?.preferred_direction ?? null,
              emailAdvisories: preference?.email_advisories ?? false,
            }}
          />
          <div className="lg:col-span-2"><SavedLocations action={removeSavedLocation} locations={saved} /></div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Correction reports</h2><Link className="font-bold text-blue-700 hover:underline" href="/report">Send a correction</Link></div>
            {reportsResult.data?.length ? (
              <ul className="mt-4 divide-y divide-slate-200">
                {reportsResult.data.map((report) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={report.id}><span className="font-semibold">{report.summary}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{report.status}</span></li>)}
              </ul>
            ) : <p className="mt-4 text-sm text-slate-600">You have not submitted any correction reports.</p>}
          </section>
        </div>
      )}
    </div>
  )
}
