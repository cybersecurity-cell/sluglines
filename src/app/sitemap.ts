import type { MetadataRoute } from 'next'

import { listPublicLocations } from '@/lib/data/public'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://sluglines.com'
  const paths = ['', '/find', '/locations', '/advisories', '/how-it-works', '/slugging-rules', '/community', '/report']
  const pages: MetadataRoute.Sitemap = paths.map((path) => ({ url: `${base}${path}`, changeFrequency: path === '/advisories' ? 'daily' : 'weekly', priority: path === '' ? 1 : 0.7 }))
  try {
    const locations = await listPublicLocations()
    pages.push(...locations.map((location) => ({ url: `${base}/locations/${location.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })))
  } catch {
    // Core routes remain discoverable when the location repository is unavailable.
  }
  return pages
}
