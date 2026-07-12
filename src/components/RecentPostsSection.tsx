import Link from 'next/link'
import { ArrowRight, CalendarDays } from 'lucide-react'
import {
  formatLegacyPostDate,
  getLegacyPostHref,
  getRecentLegacyPosts,
  summarizeLegacyPost,
} from '@/lib/legacy-posts'

export default function RecentPostsSection() {
  const posts = getRecentLegacyPosts(3)

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">Latest archive updates</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Commuter news and notes</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Browse migrated Sluglines posts in a cleaner format, including route changes, Metro work, and HOV updates.
            </p>
          </div>
          <Link href="/blog" className="text-sm font-bold text-sky-700 hover:text-sky-900">
            View blog
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.path}
              href={getLegacyPostHref(post)}
              className="group rounded-lg border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatLegacyPostDate(post)}
              </div>
              <h3 className="text-lg font-bold leading-snug text-slate-950 group-hover:text-sky-800">{post.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{summarizeLegacyPost(post, 145)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-sky-700">
                Read more
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
