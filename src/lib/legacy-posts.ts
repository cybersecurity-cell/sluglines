import { LEGACY_SITE_INVENTORY, type LegacyRoute } from './legacy-content.ts'

export function getRecentLegacyPosts(limit = 24): LegacyRoute[] {
  return LEGACY_SITE_INVENTORY.routes
    .filter((route) => route.kind === 'post')
    .sort((left, right) => getPostTime(right) - getPostTime(left))
    .slice(0, limit)
}

export function getRelatedLegacyPosts(topic: 'blog' | 'news', limit = 24): LegacyRoute[] {
  const posts = getRecentLegacyPosts(LEGACY_SITE_INVENTORY.routes.length)

  if (topic === 'blog') {
    return posts.slice(0, limit)
  }

  const newsTerms = ['metro', 'slug', 'slugline', 'commuter', 'hov', 'express', 'shutdown', 'parking', 'route']

  return posts
    .filter((post) => {
      const text = `${post.title} ${post.bodyText}`.toLowerCase()
      return newsTerms.some((term) => text.includes(term))
    })
    .slice(0, limit)
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
