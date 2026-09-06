import Link from 'next/link'
import CommunityLinksCard from '@/components/CommunityLinksCard'
import type { LegacyRoute } from '@/lib/legacy-content'
import { findSpotBySlug } from '@/lib/spot-directory'
import { sanitizeLegacyHtml } from '@/lib/legacy-html'

interface LegacyContentPageProps {
  page: LegacyRoute
  /**
   * A present-tense qualifier rendered above a migrated body whose claims are
   * no longer true (issue #142). The body itself is preserved verbatim — the
   * content-preservation rule — but a page telling visitors to download an app
   * that no longer exists needs to say when it was written and what replaced it.
   */
  notice?: string
}

export default function LegacyContentPage({ page, notice }: LegacyContentPageProps) {
  const primaryCtas = page.ctas
    .filter((cta) => cta.href.startsWith('/') && cta.href !== page.path && !cta.href.startsWith('/forum'))
    .slice(0, 4)
  const legacySpot = findLegacySpot(page.path)
  // Sanitized at the sink, not trusted from the data file: legacy-site-content.json
  // is a committed artifact generated before the sanitizer existed, and
  // legacy-content.ts synthesizes contentHtml for index pages at runtime.
  const safeContentHtml = sanitizeLegacyHtml(page.contentHtml)

  return (
    <div className="bg-white text-[#17202A]">
      <section className="border-b border-stone-200 bg-[#FAFAF8]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">
            {page.kind === 'post' ? 'Sluglines News' : 'Sluglines'}
          </p>
          <h1 className="h-display max-w-4xl text-4xl text-[#17202A] md:text-5xl">
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
                  className="inline-flex min-h-[44px] items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-[#17202A] transition-colors hover:border-[#2E7D46] hover:text-[#2E7D46]"
                >
                  {cta.text}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
        {notice && (
          <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            {notice}
          </p>
        )}
        <article
          className="legacy-content min-w-0 rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:p-8"
          dangerouslySetInnerHTML={{ __html: safeContentHtml }}
        />
        </div>

        <aside className="space-y-4">
          <CommunityLinksCard spotSlug={legacySpot?.slug} fallbackUrl={legacySpot?.fbUrl} />

          {page.headings.length > 0 && (
            <nav className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#2E7D46]">On This Page</h2>
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
