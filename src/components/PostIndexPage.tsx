import Link from 'next/link'
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react'
import {
  formatLegacyPostDate,
  getLegacyPostHref,
  getRelatedLegacyPosts,
  summarizeLegacyPost,
} from '@/lib/legacy-posts'

interface PostIndexPageProps {
  title: string
  eyebrow: string
  description: string
  topic: 'blog' | 'news'
}

export default function PostIndexPage({ title, eyebrow, description, topic }: PostIndexPageProps) {
  const posts = getRelatedLegacyPosts(topic, 30)
  const [featuredPost, ...secondaryPosts] = posts

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700">{eyebrow}</p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {featuredPost && (
          <Link
            href={getLegacyPostHref(featuredPost)}
            className="group mb-8 grid grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm transition-transform hover:-translate-y-0.5 lg:grid-cols-[1fr_22rem]"
          >
            <div className="p-6 md:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-200">
                <Newspaper className="h-3.5 w-3.5" />
                Featured
              </div>
              <h2 className="max-w-2xl text-3xl font-bold leading-tight md:text-4xl">{featuredPost.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{summarizeLegacyPost(featuredPost, 230)}</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-sky-200">
                Read update
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
            <div className="border-t border-white/10 bg-sky-500/10 p-6 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <CalendarDays className="h-4 w-4" />
                {formatLegacyPostDate(featuredPost)}
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-300">
                Migrated from the original Sluglines archive and reformatted for easier browsing.
              </p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {secondaryPosts.map((post) => (
            <Link
              key={post.path}
              href={getLegacyPostHref(post)}
              className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatLegacyPostDate(post)}
              </div>
              <h2 className="text-lg font-bold leading-snug text-slate-950 group-hover:text-sky-800">{post.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{summarizeLegacyPost(post)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-sky-700">
                Read more
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
