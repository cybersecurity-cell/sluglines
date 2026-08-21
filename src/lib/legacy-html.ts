// Allow-list sanitizer for archived WordPress markup.
//
// The output of this module is handed to dangerouslySetInnerHTML in
// LegacyContentPage. It runs at render time rather than only in the migration
// script because the rendered HTML comes from a committed 6.37 MB artifact
// (src/data/legacy-site-content.json) that predates the sanitizer, and because
// legacy-content.ts also synthesizes contentHtml for index pages at runtime.
// Sanitizing at the sink makes the guarantee hold regardless of how the markup
// got there.
//
// Allow-list, not denylist: a denylist must anticipate every encoding of every
// construct it means to remove, and the previous regex version missed nested
// tags, unquoted handlers, entity-encoded schemes, control characters inside a
// scheme, and every tag it simply never named. This only has to recognise what
// it keeps.

import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5'

// Elements whose contents are not markup. Unwrapping these would paste raw
// JavaScript or CSS into the document as visible text.
const DROP_SUBTREE = new Set([
  'script', 'style', 'svg', 'math', 'noscript', 'template', 'iframe', 'object',
  'embed', 'applet', 'frame', 'frameset', 'canvas', 'audio', 'video', 'source',
  'track', 'map', 'area', 'link', 'meta', 'base', 'title', 'input', 'textarea',
  'select', 'option', 'optgroup', 'button', 'output', 'progress', 'meter', 'dialog',
])

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'small', 'sub', 'sup', 'code',
  'pre', 'blockquote', 'q', 'cite', 'abbr', 'mark', 'time', 'address',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption',
])

// Per-tag attribute allow-list. Anything unnamed is dropped, which is how every
// on* handler dies without a rule having to know its name.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
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
const LEGACY_HOSTS = new Set(['sluglines.com', 'www.sluglines.com'])

interface Attr {
  name: string
  value: string
}

interface SanitizedNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Attr[]
  childNodes?: SanitizedNode[]
}

// Browsers ignore C0 controls, space and DEL inside a URL, so a tab spliced into
// a scheme name still navigates. The scheme must be read with those removed.
function stripControlChars(value: string): string {
  return value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 32 && code !== 127
    })
    .join('')
}

export function safeUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null

  const probe = stripControlChars(value).toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe)
  if (scheme) return SAFE_SCHEMES.has(scheme[1]) ? value : null
  if (probe.startsWith('//')) return null // protocol-relative: an off-site host
  return value // in-page anchor or site-relative path
}

// Absolute links back to the legacy origin become relative. Compares the parsed
// hostname exactly: a startsWith('https://sluglines.com') test also accepts
// https://sluglines.com.example.net/, which is a different site.
function internalizeUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value, 'https://sluglines.com')
  } catch {
    return value
  }
  if (!LEGACY_HOSTS.has(url.hostname)) return value
  if (url.pathname.startsWith('/wp-content') || url.pathname.startsWith('/images')) return value
  return `${url.pathname}${url.search}${url.hash}` || '/'
}

function filterAttrs(tagName: string, attrs: Attr[]): Attr[] {
  const permitted = ALLOWED_ATTRS[tagName]
  const out: Attr[] = []

  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    if (!GLOBAL_ATTRS.has(name) && !permitted?.has(name)) continue

    if (name === 'class') {
      const present = attr.value.split(/\s+/)
      const kept = KEEP_CLASSES.filter((className) => present.includes(className))
      if (kept.length) out.push({ name: 'class', value: kept.join(' ') })
      continue
    }

    if (name === 'id') {
      // Kept for in-page anchors, but constrained: an arbitrary id inside a
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

    out.push({ name, value: attr.value })
  }

  return out
}

function isViewCounterNoise(tagName: string, attrs: Attr[]): boolean {
  const id = attrs.find((attr) => attr.name.toLowerCase() === 'id')?.value ?? ''
  const cls = attrs.find((attr) => attr.name.toLowerCase() === 'class')?.value ?? ''
  if (tagName === 'p' && id.startsWith('pvc_stats_')) return true
  if (tagName === 'div' && cls.split(/\s+/).includes('pvc_clear')) return true
  return false
}

interface ParsedNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: Attr[]
  childNodes?: ParsedNode[]
}

function sanitizeNodes(nodes: ParsedNode[]): SanitizedNode[] {
  const out: SanitizedNode[] = []

  for (const node of nodes) {
    if (node.nodeName === '#text') {
      out.push({ nodeName: '#text', value: node.value ?? '' })
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
      if (!kept.some((attr) => attr.name === 'src')) continue
      if (!kept.some((attr) => attr.name === 'loading')) {
        kept.push({ name: 'loading', value: 'lazy' })
      }
    }

    if (tagName === 'a' && kept.some((attr) => attr.name === 'target' && attr.value === '_blank')) {
      const rel = kept.find((attr) => attr.name === 'rel')
      if (rel) rel.value = 'noopener noreferrer'
      else kept.push({ name: 'rel', value: 'noopener noreferrer' })
    }

    out.push({ nodeName: tagName, tagName, attrs: kept, childNodes: children })
  }

  return out
}

export function sanitizeLegacyHtml(html: string | null | undefined): string {
  if (!html) return ''
  const fragment = parseFragment(String(html)) as unknown as ParsedNode
  const sanitized = sanitizeNodes(fragment.childNodes ?? [])
  // parse5's serializer reads only childNodes/tagName/attrs/value, all of which
  // SanitizedNode supplies. The full tree-adapter node type also carries parentNode
  // and namespace fields that a rebuilt tree has no meaningful values for, so the
  // cast targets parse5's own ParentNode rather than any.
  const root = { childNodes: sanitized } as unknown as DefaultTreeAdapterTypes.ParentNode
  return serialize(root).replace(/\n{3,}/g, '\n\n').trim()
}

// Plain-text extraction. Uses the parser rather than /<[^>]+>/g, which ends a tag
// at the first '>' and so leaks attribute contents: `<a title="a>b">` left a
// stray `b">` in what was supposed to be text.
export function legacyHtmlToText(html: string | null | undefined): string {
  if (!html) return ''
  const parts: string[] = []

  const walk = (nodes: ParsedNode[]): void => {
    for (const node of nodes) {
      if (node.nodeName === '#text') {
        parts.push(node.value ?? '')
      } else if (node.nodeName === '#comment') {
        continue
      } else if (DROP_SUBTREE.has(node.tagName?.toLowerCase() ?? '')) {
        continue
      } else if (node.childNodes) {
        walk(node.childNodes)
      }
    }
  }

  const fragment = parseFragment(String(html)) as unknown as ParsedNode
  walk(fragment.childNodes ?? [])
  // parse5 has already resolved entities, so no decode pass is needed.
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
