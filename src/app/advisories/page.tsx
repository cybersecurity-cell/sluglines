import type { Metadata } from 'next'

import { AdvisoryList } from '@/components/AdvisoryList'
import { listPublicAdvisories } from '@/lib/data/public'
import type { AdvisorySummary } from '@/lib/domain/advisory'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Community advisories | Sluglines', description: 'Review active, source-labelled advisories affecting slugging locations.' }

export default async function AdvisoriesPage() {
  let advisories: AdvisorySummary[] = []
  let unavailable = false
  try { advisories = await listPublicAdvisories() } catch { unavailable = true }
  return <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Updates</p><h1 className="mt-2 text-4xl font-black tracking-tight">Advisories</h1><p className="mt-4 max-w-2xl leading-7 text-slate-600">Published notices are ordered by urgency and include their source and review status.</p><div className="mt-8"><AdvisoryList advisories={advisories} unavailable={unavailable} /></div></div>
}
