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
    <div className="bg-white text-[#17202A]">
      <section className="border-b border-stone-200 bg-[#FAFAF8]">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#2E7D46]">{eyebrow}</p>
          <h1 className="h-display max-w-4xl text-4xl text-[#17202A] md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {featuredPost && (
          <Link
            href={getLegacyPostHref(featuredPost)}
            className="group mb-8 grid grid-cols-1 overflow-hidden rounded-lg border border-stone-200 bg-[#17202A] text-white shadow-sm transition-transform hover:-translate-y-0.5 lg:grid-cols-[1fr_22rem]"
          >
            <div className="p-6 md:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-[#7BC994]">
                <Newspaper className="h-3.5 w-3.5" />
                Featured
              </div>
              <h2 className="h-display max-w-2xl text-3xl leading-tight md:text-4xl">{featuredPost.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{summarizeLegacyPost(featuredPost, 230)}</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#7BC994]">
                Read update
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
            <div className="border-t border-white/10 bg-white/5 p-6 lg:border-l lg:border-t-0">
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
              className="group rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-[#2E7D46] hover:bg-[#EAF2ED]"
            >
              {/* slate-600 and #1F5C33 rather than slate-500 and #2E7D46: both
                  land on the accent tint when this card is hovered, where the
                  lighter pair drops to 4.17:1 and 4.45:1. */}
              <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-slate-600">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatLegacyPostDate(post)}
              </div>
              <h2 className="h-display text-lg leading-snug text-[#17202A] group-hover:text-[#1F5C33]">{post.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{summarizeLegacyPost(post)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2E7D46]">
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
