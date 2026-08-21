import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseFragment, serialize } from 'parse5'

const SITE_ORIGIN = 'https://sluglines.com'
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_DATA = join(REPO_ROOT, 'src/data/legacy-site-content.json')
const OUT_INVENTORY = join(REPO_ROOT, 'Docs/sluglines-content-inventory.md')

const EXTRA_ROUTES = [
  '/service/slug-lines-status/',
  '/service/premium-consulting/',
  '/service/slug-lines-lost-found/',
  '/service/organizing-new-slug-lines/',
  '/portfolio-item/i66-tolls/',
  '/portfolio-item/hdr-gallery/',
  '/portfolio-item/chinese-pond/',
]

async function main() {
  const [pages, posts] = await Promise.all([
    fetchWpCollection('pages'),
    fetchWpCollection('posts'),
  ])

  const apiRoutes = [
    ...pages.map((item) => wpItemToRoute(item, 'page')),
    ...posts.map((item) => wpItemToRoute(item, 'post')),
  ]

  const routesByPath = new Map()
  for (const route of apiRoutes) {
    routesByPath.set(route.path, route)
  }

  routesByPath.set('/', {
    id: 'home-root',
    kind: 'home',
    path: '/',
    sourceUrl: `${SITE_ORIGIN}/`,
    slug: '',
    title: 'Home',
    modified: null,
    parent: 0,
    template: 'front-page',
    apiContentHtml: '',
  })

  for (const path of EXTRA_ROUTES) {
    if (!routesByPath.has(path)) {
      routesByPath.set(path, {
        id: `extra:${path}`,
        kind: path.startsWith('/service/') ? 'service' : 'portfolio-item',
        path,
        sourceUrl: `${SITE_ORIGIN}${path}`,
        slug: path.split('/').filter(Boolean).at(-1) || '',
        title: titleFromSlug(path),
        modified: null,
        parent: 0,
        template: 'rendered-template',
        apiContentHtml: '',
      })
    }
  }

  const routes = []
  for (const route of [...routesByPath.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    let html = ''
    let fetchError = ''
    try {
      html = await fetchText(route.sourceUrl)
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error)
      html = ''
    }
    const seo = extractSeo(html, route.title)
    const navLinks = extractNavigationLinks(html)
    const contentHtml = html
      ? normalizeContentHtml(extractRenderedContent(html, route.path), route.path)
      : `<p>Legacy source route returned an error during migration: ${escapeHtml(fetchError)}.</p>`
    const assets = extractAssets(contentHtml)
    const links = extractLinks(contentHtml)
    const forms = extractForms(contentHtml)
    const bodyText = stripHtml(contentHtml)

    routes.push({
      ...withoutApiContent(route),
      fetchError,
      title: seo.title || route.title,
      seo,
      headings: extractHeadings(contentHtml),
      bodyText,
      contentHtml,
      ctas: uniqueLinks([...navLinks, ...links])
        .filter((link) => link.text && link.text.length <= 80)
        .slice(0, 30),
      links,
      assets,
      forms,
    })
  }

  const homeShellHtml = await fetchText(`${SITE_ORIGIN}/`)
  const siteFooter = extractSiteFooter(homeShellHtml)

  const inventory = {
    source: SITE_ORIGIN,
    auditedAt: new Date().toISOString(),
    totals: {
      routes: routes.length,
      pages: routes.filter((route) => route.kind === 'page').length,
      posts: routes.filter((route) => route.kind === 'post').length,
      slugPickupPages: routes.filter((route) => route.path.startsWith('/slug_pickup/')).length,
      assets: uniqueStrings(routes.flatMap((route) => route.assets)).length,
      forms: routes.reduce((sum, route) => sum + route.forms.length, 0),
      links: uniqueLinks(routes.flatMap((route) => route.links)).length,
    },
    navigation: extractSiteNavigation(homeShellHtml),
    footer: siteFooter,
    routes,
  }

  await writeJson(OUT_DATA, inventory)
  await writeInventory(OUT_INVENTORY, inventory)

  console.log(`Migrated ${inventory.totals.routes} routes from ${SITE_ORIGIN}`)
  console.log(`Wrote ${OUT_DATA}`)
  console.log(`Wrote ${OUT_INVENTORY}`)
}

async function fetchWpCollection(restBase) {
  const firstUrl = `${SITE_ORIGIN}/wp-json/wp/v2/${restBase}?per_page=100&page=1`
  const firstResponse = await fetch(firstUrl)
  if (!firstResponse.ok) {
    throw new Error(`Failed to fetch ${firstUrl}: ${firstResponse.status}`)
  }

  const totalPages = Number(firstResponse.headers.get('x-wp-totalpages') || '1')
  const items = await firstResponse.json()

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetch(`${SITE_ORIGIN}/wp-json/wp/v2/${restBase}?per_page=100&page=${page}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${restBase} page ${page}: ${response.status}`)
    }
    items.push(...await response.json())
  }

  return items
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Sluglines content migration audit',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.text()
}

function wpItemToRoute(item, kind) {
  const url = new URL(item.link)
  return {
    id: item.id,
    kind,
    path: ensureTrailingSlash(url.pathname),
    sourceUrl: item.link,
    slug: item.slug,
    title: decodeHtml(stripHtml(item.title?.rendered || item.slug)),
    modified: item.modified || null,
    parent: item.parent || 0,
    template: item.template || '',
    apiContentHtml: item.content?.rendered || '',
  }
}

function withoutApiContent(route) {
  const { apiContentHtml, ...rest } = route
  return rest
}

function extractSeo(html, fallbackTitle) {
  const title = decodeHtml(matchFirst(html, /<title>([\s\S]*?)<\/title>/i) || fallbackTitle)
  const description = decodeHtml(
    matchFirst(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || ''
  )
  const canonical = matchFirst(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i) || ''
  const ogTitle = decodeHtml(matchFirst(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i) || '')
  const ogDescription = decodeHtml(
    matchFirst(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i) || ''
  )

  return {
    title,
    description,
    canonical,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
    },
  }
}

function extractNavigationLinks(html) {
  const header = matchFirst(html, /<ul id=["']menu-main["'][^>]*>([\s\S]*?)<\/ul>/i) || ''
  return extractLinks(header)
}

function extractSiteNavigation(html) {
  return extractNavigationLinks(html).filter((link) =>
    ['SLUG PICKUP', 'APP', 'FORUM', 'BLOG', 'NEWS', 'LOGIN', 'REGISTER'].includes(link.text)
  )
}

function extractSiteFooter(html) {
  const subfooter = extractBetween(html, '<section id="subfooter"', '<footer id="footer"', true)
  const footer = extractBetween(html, '<footer id="footer"', '</footer>', true)
  const subfooterLinks = extractLinks(subfooter)
  const footerLinks = extractLinks(footer)

  return {
    quickLinks: uniqueLinks([...subfooterLinks, ...footerLinks]).filter((link) =>
      ['Lost & Found', 'Metro Shutdown 2019', 'Slugging Rules and Etiquette'].includes(link.text)
    ),
    aboutLinks: subfooterLinks.filter((link) =>
      ['SLUG PICKUP', 'APP', 'FORUM', 'BLOG', 'NEWS', 'LOGIN', 'REGISTER'].includes(link.text)
    ),
    socialLinks: subfooterLinks.filter((link) =>
      ['Facebook', 'Twitter', 'YouTube'].includes(link.text)
    ),
  }
}

function extractRenderedContent(html, path) {
  if (path === '/') {
    return extractBetween(html, '<div id="slider"', '<section id="subfooter"', true) ||
      extractBetween(html, '<header id="header"', '<section id="subfooter"', true) ||
      html
  }

  const pageTitle = extractBetween(html, '<section id="pagetitle"', '<div id="main"', true) || ''
  const main = extractBetween(html, '<div id="main"', '<section id="subfooter"', true) ||
    extractBetween(html, '<article', '<section id="subfooter"', true) ||
    ''

  return `${pageTitle}${main}` || html
}

// Elements whose *contents* are not markup and must never survive. Unwrapping
// these would paste raw JS or CSS into the document as text.
const DROP_SUBTREE = new Set([
  'script', 'style', 'svg', 'math', 'noscript', 'template', 'iframe', 'object',
  'embed', 'applet', 'frame', 'frameset', 'canvas', 'audio', 'video', 'source',
  'track', 'map', 'area', 'link', 'meta', 'base', 'title', 'input', 'textarea',
  'select', 'option', 'optgroup', 'button', 'output', 'progress', 'meter', 'dialog',
])

// Everything renderable in an archived content page. Anything absent is unwrapped
// (children kept, element discarded) rather than dropped, so prose inside an
// unrecognised wrapper — a <form>, a web-component — is never silently lost.
const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'small', 'sub', 'sup', 'code',
  'pre', 'blockquote', 'q', 'cite', 'abbr', 'mark', 'time', 'address',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption',
])

// Per-tag attribute allow-list. Anything not named here is dropped, which is how
// every on* handler dies without a regex having to anticipate its name.
const ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'name', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan', 'headers', 'scope']),
  th: new Set(['colspan', 'rowspan', 'headers', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  time: new Set(['datetime']),
}
const GLOBAL_ATTRS = new Set(['class', 'id', 'lang', 'dir'])
const KEEP_CLASSES = ['alignright', 'alignleft', 'aligncenter', 'wp-caption', 'section-heading']
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

// Browsers ignore C0 controls, space and DEL inside a URL, so a tab or newline
// spliced into a scheme name still navigates. The scheme has to be read from a
// string with those removed, not from the raw attribute value.
function stripControlChars(value) {
  return String(value)
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 32 && code !== 127
    })
    .join('')
}

// Scheme allow-list, not a "javascript:" denylist: an allow-list does not have to
// enumerate the encodings of the thing it is refusing.
function safeUrl(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const probe = stripControlChars(value).toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe)
  if (scheme) return SAFE_SCHEMES.has(scheme[1]) ? value : null
  if (probe.startsWith('//')) return null // protocol-relative: an off-site host
  return value // in-page anchor or site-relative path
}

// Absolute links back to the legacy origin become relative. Compares the parsed
// hostname exactly — a `startsWith('https://sluglines.com')` test also accepts
// `https://sluglines.com.example.net/`, which is a different site.
function internalizeUrl(value) {
  let url
  try {
    url = new URL(value, SITE_ORIGIN)
  } catch {
    return value
  }
  if (url.hostname !== 'sluglines.com' && url.hostname !== 'www.sluglines.com') return value
  if (url.pathname.startsWith('/wp-content') || url.pathname.startsWith('/images')) return value
  return `${url.pathname}${url.search}${url.hash}` || '/'
}

function filterAttrs(tagName, attrs) {
  const permitted = ALLOWED_ATTRS[tagName]
  const out = []
  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    if (!GLOBAL_ATTRS.has(name) && !permitted?.has(name)) continue

    if (name === 'class') {
      const kept = KEEP_CLASSES.filter((className) => attr.value.split(/\s+/).includes(className))
      if (kept.length) out.push({ name: 'class', value: kept.join(' ') })
      continue
    }
    if (name === 'id') {
      // Kept for in-page anchors, but constrained: an arbitrary id in a
      // dangerouslySetInnerHTML subtree is a DOM-clobbering primitive.
      if (/^[A-Za-z][\w-]*$/.test(attr.value)) out.push({ name: 'id', value: attr.value })
      continue
    }
    if (name === 'href' || name === 'src') {
      const safe = safeUrl(attr.value)
      if (safe === null) continue
      out.push({ name, value: internalizeUrl(safe) })
      continue
    }
    if (name === 'target') {
      out.push({ name: 'target', value: attr.value })
      continue
    }
    out.push({ name, value: attr.value })
  }
  return out
}

function isViewCounterNoise(tagName, attrs) {
  const id = attrs.find((a) => a.name.toLowerCase() === 'id')?.value ?? ''
  const cls = attrs.find((a) => a.name.toLowerCase() === 'class')?.value ?? ''
  if (tagName === 'p' && id.startsWith('pvc_stats_')) return true
  if (tagName === 'div' && cls.split(/\s+/).includes('pvc_clear')) return true
  return false
}

function sanitizeNodes(nodes) {
  const out = []
  for (const node of nodes) {
    if (node.nodeName === '#text') {
      out.push({ nodeName: '#text', value: node.value })
      continue
    }
    if (node.nodeName === '#comment' || node.nodeName === '#documentType') continue

    const tagName = node.tagName?.toLowerCase()
    if (!tagName) continue
    if (DROP_SUBTREE.has(tagName)) continue

    const attrs = node.attrs ?? []
    if (isViewCounterNoise(tagName, attrs)) continue

    const children = sanitizeNodes(node.childNodes ?? [])
    if (!ALLOWED_TAGS.has(tagName)) {
      out.push(...children) // unwrap: keep the prose, discard the element
      continue
    }

    const kept = filterAttrs(tagName, attrs)
    if (tagName === 'img') {
      if (!kept.some((a) => a.name === 'src')) continue // an img with no safe src is nothing
      if (!kept.some((a) => a.name === 'loading')) kept.push({ name: 'loading', value: 'lazy' })
    }
    if (tagName === 'a' && kept.some((a) => a.name === 'target' && a.value === '_blank')) {
      const rel = kept.find((a) => a.name === 'rel')
      if (rel) rel.value = 'noopener noreferrer'
      else kept.push({ name: 'rel', value: 'noopener noreferrer' })
    }

    out.push({ nodeName: tagName, tagName, attrs: kept, childNodes: children })
  }
  return out
}

function normalizeContentHtml(html, path) {
  // Parsed with a spec-compliant parser and rebuilt from an allow-list, rather
  // than pattern-matching unwanted tags out of a string. A regex stripper has to
  // anticipate every encoding of every construct it means to remove; this only
  // has to recognise what it means to keep. parse5 also decodes entities, so
  // `&#106;avascript:` reaches safeUrl() already decoded.
  const sanitized = serialize({ childNodes: sanitizeNodes(parseFragment(String(html ?? '')).childNodes) })
  const content = sanitized.replace(/\n{3,}/g, '\n\n').trim()

  if (!content) {
    return `<p>Content migrated from ${escapeHtml(path)}.</p>`
  }

  return content
}

function extractHeadings(html) {
  const headings = []
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
  for (const match of html.matchAll(regex)) {
    const text = stripHtml(match[2])
    if (text) headings.push({ level: Number(match[1]), text })
  }
  const sectionHeadingRegex = /<div\b[^>]*class=["'][^"']*section-heading[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  for (const match of html.matchAll(sectionHeadingRegex)) {
    const text = stripHtml(match[1])
    if (text && !headings.some((heading) => heading.text === text)) {
      headings.push({ level: 2, text })
    }
  }
  return headings
}

function extractLinks(html) {
  const links = []
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(regex)) {
    const href = normalizeHref(match[1])
    const text = stripHtml(match[2]) || extractImageLabel(match[2])
    if (href && text) links.push({ text, href })
  }
  return uniqueLinks(links)
}

function extractImageLabel(html) {
  return decodeHtml(
    matchFirst(html, /alt=["']([^"']+)["']/i) ||
    matchFirst(html, /title=["']([^"']+)["']/i) ||
    ''
  ).trim()
}

function extractAssets(html) {
  const assets = []
  const regex = /<(?:img|source)\b[^>]*(?:src|srcset)=["']([^"']+)["'][^>]*>/gi
  for (const match of html.matchAll(regex)) {
    const value = match[1].split(',')[0].trim().split(/\s+/)[0]
    if (value) assets.push(value)
  }
  return uniqueStrings(assets)
}

function extractForms(html) {
  const forms = []
  const regex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  for (const match of html.matchAll(regex)) {
    forms.push({
      action: normalizeHref(matchFirst(match[1], /action=["']([^"']*)["']/i) || ''),
      method: (matchFirst(match[1], /method=["']([^"']*)["']/i) || 'get').toLowerCase(),
      fields: [...match[2].matchAll(/<(input|select|textarea)\b[^>]*(?:name=["']([^"']+)["'])?[^>]*>/gi)]
        .map((field) => field[2])
        .filter(Boolean),
    })
  }
  return forms
}

// Host comparison is on the parsed hostname, not a string prefix. The previous
// `startsWith('https://sluglines.com')` test also matched
// `https://sluglines.com.example.net/` — a different site entirely, whose path
// would then have been emitted as an internal link.
function normalizeHref(href) {
  if (!href) return ''
  const decoded = decodeHtml(String(href).trim())
  if (!decoded) return ''
  if (safeUrl(decoded) === null) return ''

  let url
  try {
    url = new URL(decoded, SITE_ORIGIN)
  } catch {
    return decoded
  }
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return decoded
  if (url.hostname === 'sluglines.com' || url.hostname === 'www.sluglines.com') {
    return `${ensureTrailingSlash(url.pathname)}${url.search || ''}${url.hash || ''}`
  }
  return url.href
}

function ensureTrailingSlash(path) {
  if (!path || path === '/') return '/'
  if (path.includes('.php')) return path
  return path.endsWith('/') ? path : `${path}/`
}

// Text extraction via the parser rather than /<[^>]+>/g, which ends a tag at the
// first '>' and so leaks attribute contents into the output: `<a title="a>b">`
// left a stray `b">` in what was supposed to be plain text.
function stripHtml(html = '') {
  if (!html) return ''
  const parts = []
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.nodeName === '#text') {
        parts.push(node.value)
      } else if (node.nodeName === '#comment') {
        continue
      } else if (DROP_SUBTREE.has(node.tagName?.toLowerCase())) {
        continue
      } else if (node.childNodes) {
        walk(node.childNodes)
      }
    }
  }
  walk(parseFragment(String(html)).childNodes)
  // parse5 has already resolved entities, so no decodeHtml pass is needed here.
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function decodeHtml(value = '') {
  const entities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    '#038': '&',
    '#039': "'",
    '#8211': '-',
    '#8212': '-',
    '#8216': "'",
    '#8217': "'",
    '#8220': '"',
    '#8221': '"',
    '#8230': '...',
  }

  return value.replace(/&([^;]+);/g, (entity, name) => {
    if (entities[name]) return entities[name]
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
    return entity
  })
}

function extractBetween(html, startNeedle, endNeedle, includeStart = false) {
  const startIndex = html.indexOf(startNeedle)
  if (startIndex === -1) return ''
  const contentStart = includeStart ? startIndex : startIndex + startNeedle.length
  const endIndex = html.indexOf(endNeedle, contentStart)
  if (endIndex === -1) return html.slice(contentStart)
  return html.slice(contentStart, endIndex)
}

function matchFirst(value, regex) {
  return regex.exec(value)?.[1] || ''
}

function titleFromSlug(path) {
  return path
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || path
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueLinks(links) {
  const seen = new Set()
  return links.filter((link) => {
    const key = `${link.text}|${link.href}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function writeInventory(path, inventory) {
  await mkdir(dirname(path), { recursive: true })
  const lines = [
    '# Sluglines.com Content Inventory',
    '',
    `Source: ${inventory.source}`,
    `Audited at: ${inventory.auditedAt}`,
    '',
    '## Totals',
    '',
    `- Routes: ${inventory.totals.routes}`,
    `- WordPress pages: ${inventory.totals.pages}`,
    `- WordPress posts: ${inventory.totals.posts}`,
    `- Slug pickup pages: ${inventory.totals.slugPickupPages}`,
    `- Unique assets: ${inventory.totals.assets}`,
    `- Forms: ${inventory.totals.forms}`,
    `- Unique links: ${inventory.totals.links}`,
    '',
    '## Navigation',
    '',
    ...inventory.navigation.map((link) => `- ${link.text}: ${link.href}`),
    '',
    '## Footer',
    '',
    '- Quick Links:',
    ...inventory.footer.quickLinks.map((link) => `  - ${link.text}: ${link.href}`),
    '- About Sluglines:',
    ...inventory.footer.aboutLinks.map((link) => `  - ${link.text}: ${link.href}`),
    '- Social media:',
    ...inventory.footer.socialLinks.map((link) => `  - ${link.text}: ${link.href}`),
    '',
    '## Routes',
    '',
    '| Path | Type | Title | SEO title | SEO description | Headings | Assets | Forms |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: |',
    ...inventory.routes.map((route) => {
      const headings = route.headings.map((heading) => `${'#'.repeat(heading.level)} ${heading.text}`).join('<br>')
      return [
        route.path,
        route.kind,
        escapePipe(route.title),
        escapePipe(route.seo.title),
        escapePipe(route.seo.description),
        escapePipe(headings),
        route.assets.length,
        route.forms.length,
      ].join(' | ')
    }),
    '',
  ]
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8')
}

// Backslash is escaped first. Escaping '|' before '\' means an input containing
// a literal backslash-pipe yields a backslash that escapes the escape, and the
// cell breaks out of the markdown table.
function escapePipe(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Exported so the sanitizer can be tested without performing the migration, which
// fetches the live site.
export { normalizeContentHtml, stripHtml, normalizeHref, safeUrl, escapePipe }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
