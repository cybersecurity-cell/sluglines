import Link from 'next/link'
import CommunityLinksCard from '@/components/CommunityLinksCard'
import type { LegacyRoute } from '@/lib/legacy-content'
import { findSpotBySlug } from '@/lib/spot-directory'

interface LegacyContentPageProps {
  page: LegacyRoute
}

export default function LegacyContentPage({ page }: LegacyContentPageProps) {
  const primaryCtas = page.ctas
    .filter((cta) => cta.href.startsWith('/') && cta.href !== page.path && !cta.href.startsWith('/forum'))
    .slice(0, 4)
  const legacySpot = findLegacySpot(page.path)

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">
            {page.kind === 'post' ? 'Sluglines News' : 'Sluglines'}
          </p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            {page.title}
          </h1>
          {page.seo.description && (
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              {page.seo.description}
            </p>
          )}
          {primaryCtas.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {primaryCtas.map((cta) => (
                <Link
                  key={`${cta.text}-${cta.href}`}
                  href={cta.href}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition-colors hover:border-sky-600 hover:text-sky-800"
                >
                  {cta.text}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article
          className="legacy-content min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-8"
          dangerouslySetInnerHTML={{ __html: page.contentHtml }}
        />

        <aside className="space-y-4">
          <CommunityLinksCard spotSlug={legacySpot?.slug} fallbackUrl={legacySpot?.fbUrl} />

          {page.headings.length > 0 && (
            <nav className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">On This Page</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {page.headings.slice(0, 12).map((heading, index) => (
                  <li key={`${heading.text}-${index}`} className={heading.level > 2 ? 'pl-3' : ''}>
                    {heading.text}
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </section>
    </div>
  )
}

function findLegacySpot(path: string) {
  if (!path.startsWith('/slug_pickup/') && !path.startsWith('/slug-pickup/')) {
    return undefined
  }

  const slug = path.split('/').filter(Boolean).at(-1)

  return slug ? findSpotBySlug(slug) : undefined
}
