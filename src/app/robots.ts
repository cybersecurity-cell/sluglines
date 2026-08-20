import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/auth/'] }],
    sitemap: 'https://sluglines.com/sitemap.xml',
  }
}
