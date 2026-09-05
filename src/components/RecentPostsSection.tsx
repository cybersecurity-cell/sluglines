import Link from 'next/link'
import { formatLegacyPostDate, getLegacyPostHref, getRecentLegacyPosts } from '@/lib/legacy-posts'

/**
 * The archive index: title and date, and deliberately no summary.
 *
 * `summarizeLegacyPost` takes the head of `bodyText`, and for every one of these
 * migrated WordPress pages `bodyText` opens with the page's own H1, then the
 * "Home" breadcrumb, then the H1 again. So the summary of the Rosslyn post is
 * "New Slug Pickup Location at Rosslyn Starting Monday April 26, 2021 Home New
 * Slug Pickup Location at Rosslyn Starting Monday April 26, 2021..." — the title
 * printed twice, next to the title.
 *
 * The old card layout stacked it under the heading, where it read as clumsy. In
 * a two-column row it reads as a bug, because it is one. The fix belongs in the
 * legacy content pipeline (strip the breadcrumb chrome at scrape time, which is
 * `src/lib/legacy-content.ts` and its own tests, not this slice); until then a
 * row that shows a title once is better than a row that shows it three times.
 */
export default function RecentPostsSection() {
  const posts = getRecentLegacyPosts(3)

  return (
    <section className="border-b border-stone-200 bg-[#FAFAF8]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              From the archive
            </p>
            <h2 className="h-display text-2xl text-[#17202A]">Past route changes, Metro work, and HOV updates</h2>
            <p className="mt-1 text-sm text-slate-500">
              Posts from the retired Sluglines blog, kept for reference. Dates are when each post was
              originally published — none of this is current.
            </p>
          </div>
          <Link href="/blog" className="text-sm font-bold text-[#2E7D46] hover:text-[#1f5c33]">
            View archive
          </Link>
        </div>

        <ul className="divide-y divide-stone-200 border-y border-stone-200 bg-white">
          {posts.map((post) => (
            <li key={post.path}>
              <Link
                href={getLegacyPostHref(post)}
                className="group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-[#FAFAF8] sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-[#17202A] group-hover:text-[#2E7D46]">
                  {post.title}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-500">{formatLegacyPostDate(post)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
