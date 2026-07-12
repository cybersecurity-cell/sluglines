import inventory from '../data/legacy-site-content.json' with { type: 'json' }

export interface LegacyLink {
  text: string
  href: string
}

export interface LegacyHeading {
  level: number
  text: string
}

export interface LegacyForm {
  action: string
  method: string
  fields: string[]
}

export interface LegacyRoute {
  id: number | string
  kind: string
  path: string
  sourceUrl: string
  slug: string
  title: string
  modified: string | null
  parent: number
  template: string
  fetchError?: string
  seo: {
    title: string
    description: string
    canonical: string
    openGraph: {
      title: string
      description: string
    }
  }
  headings: LegacyHeading[]
  bodyText: string
  contentHtml: string
  ctas: LegacyLink[]
  links: LegacyLink[]
  assets: string[]
  forms: LegacyForm[]
}

export interface LegacySiteInventory {
  source: string
  auditedAt: string
  totals: {
    routes: number
    pages: number
    posts: number
    slugPickupPages: number
    assets: number
    forms: number
    links: number
  }
  navigation: LegacyLink[]
  footer: {
    quickLinks: LegacyLink[]
    aboutLinks: LegacyLink[]
    socialLinks: LegacyLink[]
  }
  routes: LegacyRoute[]
}

export const LEGACY_SITE_INVENTORY = inventory as LegacySiteInventory

const MODERN_PUBLIC_PATHS = new Set([
  '/blog/',
  '/news/',
  '/slug_pickup/',
  '/slugging-rules-and-etiquette/',
])

const legacyRoutesByPath = new Map(
  LEGACY_SITE_INVENTORY.routes.map((route) => [normalizeLegacyPath(route.path), route])
)

const legacyRoutesByLowerPath = new Map(
  LEGACY_SITE_INVENTORY.routes.map((route) => [normalizeLegacyPath(route.path).toLowerCase(), route])
)

export function getLegacyPageByPath(path: string): LegacyRoute | undefined {
  return legacyRoutesByPath.get(normalizeLegacyPath(path))
}

export function getLegacyRouteForPath(path: string): LegacyRoute | undefined {
  const normalizedPath = normalizeLegacyPath(path)
  const slugPickupAlias = normalizedPath.replace(/^\/slug-pickup\//i, '/slug_pickup/')
  const postAlias = normalizedPath.replace(/^\/(?:blog|news)\//i, '/')
  const sluggingEtiquetteAlias = normalizedPath.replace(/^\/slugging-etiquette\//i, '/')

  return legacyRoutesByPath.get(normalizedPath) ||
    legacyRoutesByLowerPath.get(normalizedPath.toLowerCase()) ||
    legacyRoutesByLowerPath.get(slugPickupAlias.toLowerCase()) ||
    legacyRoutesByLowerPath.get(postAlias.toLowerCase()) ||
    legacyRoutesByLowerPath.get(sluggingEtiquetteAlias.toLowerCase()) ||
    buildGeneratedLegacyRoute(normalizedPath)
}

export function getLegacyStaticParams() {
  const routePaths = new Set(
    LEGACY_SITE_INVENTORY.routes
      .map((route) => normalizeLegacyPath(route.path))
      .filter((path) => path !== '/' && !MODERN_PUBLIC_PATHS.has(path))
  )

  for (const route of LEGACY_SITE_INVENTORY.routes) {
    for (const link of route.links) {
      if (!link.href.startsWith('/') || isHandledLegacyInternalLink(link.href)) continue

      const linkedRoute = getLegacyRouteForPath(link.href)
      if (linkedRoute) {
        const normalizedLinkPath = normalizeLegacyPath(link.href)

        if (!MODERN_PUBLIC_PATHS.has(normalizedLinkPath)) {
          routePaths.add(normalizedLinkPath)
        }
      }
    }
  }

  return Array.from(routePaths)
    .map((route) => ({
      legacyPath: route.replace(/^\/|\/$/g, '').split('/'),
    }))
}

export function isHandledLegacyInternalLink(href: string) {
  return [
    /^#/,
    /^\/\//,
    /^\/$/,
    /^\/a\/wp-content\//,
    /^\/docs\//,
    /^\/wp-admin\//,
    /^\/wp-content\//,
    /^\/wp-includes\//,
    /^\/wp-json\//,
    /^\/images\//,
    /^\/feed\/?$/,
    /^\/comments\/feed\/?$/,
  ].some((pattern) => pattern.test(href))
}

export function normalizeLegacyPath(path: string) {
  if (!path || path === '/') return '/'

  const pathWithoutOrigin = path.startsWith('http')
    ? new URL(path).pathname
    : path

  const [pathname] = pathWithoutOrigin.split(/[?#]/)
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`

  if (withLeadingSlash.includes('.php')) {
    return withLeadingSlash
  }

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export function buildLegacyMetadata(page: LegacyRoute) {
  const title = page.seo.title || `${page.title} - Sluglines`
  const description = page.seo.description || page.bodyText.slice(0, 155)

  return {
    title,
    description,
    alternates: {
      canonical: page.seo.canonical || `https://sluglines.com${page.path}`,
    },
    openGraph: {
      title: page.seo.openGraph.title || title,
      description: page.seo.openGraph.description || description,
      url: `https://sluglines.com${page.path}`,
      siteName: 'Sluglines',
      type: page.kind === 'post' ? 'article' : 'website',
    },
    twitter: {
      card: 'summary',
      title: page.seo.openGraph.title || title,
      description: page.seo.openGraph.description || description,
    },
  }
}

function buildGeneratedLegacyRoute(path: string): LegacyRoute | undefined {
  const normalizedPath = normalizeLegacyPath(path)

  if (isArchivePath(normalizedPath)) {
    return buildArchiveRoute(normalizedPath)
  }

  if (normalizedPath === '/wp-login.php') {
    return buildUtilityRoute(
      normalizedPath,
      'Login - Sluglines',
      'The original Sluglines login and registration endpoints are preserved as legacy links.',
      [
        { text: 'Forum', href: '/forum/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath.startsWith('/slug_pickup/') || normalizedPath.startsWith('/slug-pickup/')) {
    return buildUtilityRoute(
      normalizedPath,
      `${titleFromSlug(normalizedPath.split('/').filter(Boolean).at(-1) || 'slug-pickup')} - Sluglines`,
      'This legacy slug pickup route is preserved from the original Sluglines directory links.',
      [
        { text: 'Slug Pickup directory', href: '/slug_pickup/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath.includes('/attachment/')) {
    return buildUtilityRoute(
      normalizedPath,
      `${titleFromSlug(normalizedPath.split('/').filter(Boolean).at(-1) || 'attachment')} - Sluglines`,
      'This legacy attachment route is preserved for migrated content links.',
      [
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath.startsWith('/portfolio-item/')) {
    return buildUtilityRoute(
      normalizedPath,
      `${titleFromSlug(normalizedPath.split('/').filter(Boolean).at(-1) || 'portfolio-item')} - Sluglines`,
      'This legacy portfolio item route is preserved from the original site structure.',
      [
        { text: 'Portfolio', href: '/portfolio/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath.startsWith('/service/')) {
    return buildUtilityRoute(
      normalizedPath,
      `${titleFromSlug(normalizedPath.split('/').filter(Boolean).at(-1) || 'service')} - Sluglines`,
      'This legacy service route is preserved from the original site structure.',
      [
        { text: 'Services', href: '/services/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath.startsWith('/forum/')) {
    return buildUtilityRoute(
      normalizedPath,
      'Sluglines Forum - Sluglines',
      'This legacy forum endpoint is preserved for migrated content links. Use the forum index for current community content.',
      [
        { text: 'Forum index', href: '/forum/' },
        { text: 'Lost & Found', href: '/forum/' },
      ]
    )
  }

  if (normalizedPath.startsWith('/participant/')) {
    return buildUtilityRoute(
      normalizedPath,
      `${titleFromSlug(normalizedPath.split('/').filter(Boolean).at(-1) || 'participant')} - Sluglines`,
      'This legacy forum participant route is preserved for migrated content links.',
      [
        { text: 'Forum index', href: '/forum/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  if (normalizedPath === '/sign-in/') {
    return buildUtilityRoute(
      normalizedPath,
      'Sign In - Sluglines',
      'This legacy sign-in route is preserved for migrated forum links.',
      [
        { text: 'Forum index', href: '/forum/' },
        { text: 'Home', href: '/' },
      ]
    )
  }

  return undefined
}

function isArchivePath(path: string) {
  return /^\/(?:tag|category|author)\/[^/]+\/$/.test(path) ||
    /^\/\d{4}\/(?:\d{2}\/)?$/.test(path) ||
    /^\/page\/\d+\/$/.test(path)
}

function buildArchiveRoute(path: string): LegacyRoute {
  const title = buildArchiveTitle(path)
  const matchingPosts = findArchivePosts(path)
  const postLinks = matchingPosts.length > 0
    ? matchingPosts.map((post) => `<li><a href="${post.path}">${escapeHtml(post.title)}</a></li>`).join('')
    : LEGACY_SITE_INVENTORY.routes
        .filter((route) => route.kind === 'post')
        .slice(0, 12)
        .map((post) => `<li><a href="${post.path}">${escapeHtml(post.title)}</a></li>`)
        .join('')

  return {
    id: `generated:${path}`,
    kind: 'archive',
    path,
    sourceUrl: `https://sluglines.com${path}`,
    slug: path.replace(/^\/|\/$/g, ''),
    title,
    modified: null,
    parent: 0,
    template: 'generated-archive',
    seo: {
      title,
      description: `Legacy Sluglines archive for ${title.replace(' - Sluglines', '')}.`,
      canonical: `https://sluglines.com${path}`,
      openGraph: {
        title,
        description: `Legacy Sluglines archive for ${title.replace(' - Sluglines', '')}.`,
      },
    },
    headings: [{ level: 1, text: title.replace(' - Sluglines', '') }],
    bodyText: `${title} Legacy Sluglines archive.`,
    contentHtml: `<h1>${escapeHtml(title.replace(' - Sluglines', ''))}</h1><p>Legacy Sluglines archive page preserved from the original site structure.</p><ul>${postLinks}</ul>`,
    ctas: [],
    links: matchingPosts.map((post) => ({ text: post.title, href: post.path })),
    assets: [],
    forms: [],
  }
}

function findArchivePosts(path: string) {
  if (/^\/\d{4}\//.test(path)) {
    const [, year, month] = path.match(/^\/(\d{4})\/(?:(\d{2})\/)?$/) || []
    return LEGACY_SITE_INVENTORY.routes.filter((route) =>
      route.kind === 'post' &&
      route.modified?.startsWith(month ? `${year}-${month}` : year)
    )
  }

  return LEGACY_SITE_INVENTORY.routes.filter((route) =>
    route.kind === 'post' &&
    route.links.some((link) => normalizeLegacyPath(link.href).toLowerCase() === path.toLowerCase())
  )
}

function buildArchiveTitle(path: string) {
  const pathParts = path.replace(/^\/|\/$/g, '').split('/')

  if (pathParts[0] === 'tag') {
    return `Tag: ${titleFromSlug(pathParts[1])} - Sluglines`
  }

  if (pathParts[0] === 'category') {
    return `Category: ${titleFromSlug(pathParts[1])} - Sluglines`
  }

  if (pathParts[0] === 'author') {
    return `Author: ${titleFromSlug(pathParts[1])} - Sluglines`
  }

  if (pathParts[0] === 'page') {
    return `Sluglines - Page ${pathParts[1]}`
  }

  return `Archive: ${pathParts.join('/')} - Sluglines`
}

function buildUtilityRoute(path: string, title: string, description: string, links: LegacyLink[]): LegacyRoute {
  return {
    id: `generated:${path}`,
    kind: 'legacy-endpoint',
    path,
    sourceUrl: `https://sluglines.com${path}`,
    slug: path.replace(/^\/|\/$/g, ''),
    title,
    modified: null,
    parent: 0,
    template: 'generated-legacy-endpoint',
    seo: {
      title,
      description,
      canonical: `https://sluglines.com${path}`,
      openGraph: {
        title,
        description,
      },
    },
    headings: [{ level: 1, text: title.replace(' - Sluglines', '') }],
    bodyText: description,
    contentHtml: `<h1>${escapeHtml(title.replace(' - Sluglines', ''))}</h1><p>${escapeHtml(description)}</p><ul>${links.map((link) => `<li><a href="${link.href}">${escapeHtml(link.text)}</a></li>`).join('')}</ul>`,
    ctas: links,
    links,
    assets: [],
    forms: [],
  }
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
