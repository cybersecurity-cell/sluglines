import type { Metadata } from 'next'
import Link from 'next/link'

import { CorrectionReportForm } from '@/components/CorrectionReportForm'
import { createClient } from '@/lib/supabase/server'

import { submitCorrectionReport } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Report a correction | Sluglines', description: 'Send a sourced correction for Sluglines location, route, parking, transit, schedule, or safety information.' }

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const client = await createClient()
  const [{ data: { user } }, locationsResult] = await Promise.all([client.auth.getUser(), client.from('locations').select('id,name').eq('published', true).order('name')])

  return <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 md:py-20"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Community review</p><h1 className="mt-2 text-4xl font-black tracking-tight">Report a correction</h1><p className="mt-4 leading-7 text-slate-600">Tell us what changed and how it can be verified. Reports are private until a steward reviews them; submitting a report does not immediately change public information.</p>{message ? <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{message.slice(0, 200)}</p> : null}{user ? <div className="mt-8"><CorrectionReportForm action={submitCorrectionReport} locations={locationsResult.data ?? []} /></div> : <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6"><h2 className="font-bold">Sign in to send a report</h2><p className="mt-2 text-sm text-slate-600">Accounts help reviewers follow up while keeping reports out of the public directory.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white" href="/auth/sign-in?next=%2Freport">Sign in</Link></div>}</div>
}
