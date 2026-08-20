import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Community resources | Sluglines', description: 'Find independent community groups that discuss Northern Virginia slugging.' }

const groups = [
  { name: 'Woodbridge Slugs Facebook group', url: 'https://www.facebook.com/groups/woodbridgeslugs' },
  { name: 'Sluglines Facebook page', url: 'https://www.facebook.com/sluglines' },
  { name: 'Pentagon Slug Lines Facebook group', url: 'https://www.facebook.com/groups/PentagonSlugLines' },
]

export default function CommunityPage() {
  return <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 md:py-20"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Independent networks</p><h1 className="mt-2 text-4xl font-black tracking-tight">Community resources</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">Facebook and WhatsApp groups often carry local discussion. Sluglines does not copy private conversations or present group posts as verified facts. Use these links to visit communities directly and respect each group&apos;s rules.</p><ul className="mt-8 grid gap-4">{groups.map((group) => <li className="rounded-2xl border border-slate-200 bg-white p-5" key={group.url}><a className="font-bold text-blue-700 underline-offset-4 hover:underline" href={group.url} rel="noreferrer" target="_blank">{group.name} <span aria-hidden="true">↗</span></a><p className="mt-2 text-sm text-slate-600">External, community-managed resource. Membership or a Facebook account may be required.</p></li>)}</ul><section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-950">About WhatsApp information</h2><p className="mt-2 text-sm leading-6 text-amber-900">Only administrators should submit public invite links, and private messages should never be imported without clear consent. Phase 1 links to approved resources; it does not automate social-group ingestion.</p></section></div>
}
