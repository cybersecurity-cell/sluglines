import { LEGACY_SITE_INVENTORY, type LegacyRoute } from './legacy-content.ts'

export function getRecentLegacyPosts(limit = 24): LegacyRoute[] {
  return LEGACY_SITE_INVENTORY.routes
    .filter((route) => route.kind === 'post')
    .sort((left, right) => getPostTime(right) - getPostTime(left))
    .slice(0, limit)
}

/**
 * A post is "news" when its TITLE names an external event — Metro work, HOV or
 * express-lane changes, a lot or line moving, a closure or shutdown. Everything
 * else is the blog. The old rule matched the same terms against the body too,
 * and since every post about slugging mentions slugging, `/blog` and `/news`
 * rendered the identical list (issue #142). Two views of one archive are
 * fine; two identical views under different names are not.
 */
const NEWS_TITLE_TERMS = [
  'metro',
  'hov',
  'express lane',
  'express lanes',
  'shutdown',
  'closure',
  'closed',
  'relocat',
  'moving',
  'moves',
  'parking',
  'construction',
  'safetrack',
  'i-95',
  'i-395',
  'i-66',
  'toll',
]

export function isNewsPost(post: LegacyRoute): boolean {
  const title = post.title.toLowerCase()
  return NEWS_TITLE_TERMS.some((term) => title.includes(term))
}

export function getRelatedLegacyPosts(topic: 'blog' | 'news', limit = 24): LegacyRoute[] {
  const posts = getRecentLegacyPosts(LEGACY_SITE_INVENTORY.routes.length)
  return posts.filter((post) => (topic === 'news' ? isNewsPost(post) : !isNewsPost(post))).slice(0, limit)
}

export function getLegacyPostHref(post: LegacyRoute) {
  return post.path.startsWith('/') ? post.path : `/${post.path}`
}

export function summarizeLegacyPost(post: LegacyRoute, maxLength = 180) {
  const summary = post.bodyText.replace(/\s+/g, ' ').trim()

  if (summary.length <= maxLength) {
    return summary
  }

  return `${summary.slice(0, maxLength).replace(/\s+\S*$/, '')}...`
}

export function formatLegacyPostDate(post: LegacyRoute) {
  if (!post.modified) {
    return 'Sluglines archive'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(post.modified))
}

function getPostTime(post: LegacyRoute) {
  return post.modified ? new Date(post.modified).getTime() : 0
}
