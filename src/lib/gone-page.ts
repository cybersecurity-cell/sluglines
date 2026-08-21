/**
 * The branded 410 document — rev. 5.3 §8 M1: "**branded 410** (page with links
 * to `/spots` and `/lostfound`)".
 *
 * WHY A STRING AND NOT A REACT PAGE
 * ---------------------------------------------------------------------------
 * A 410 has to *be* a 410. An App Router page cannot set one (200 or
 * `notFound()`'s 404 are its only options), so the response comes from a Route
 * Handler — and a Route Handler has no access to the layout's hashed Tailwind
 * bundle. Rather than link a stylesheet URL that a build could rename, the page
 * carries its own ~30 lines of CSS built from the §10 tokens. It is a dead-end
 * page by definition: a wordmark, one sentence, and the two links §8 names.
 *
 * COLOURS ARE THE §10 TOKENS, AND THE CONTRAST IS TESTED
 * ---------------------------------------------------------------------------
 * Ground `#FAFAF8`, ink `#17202A`, accent highway-green `#2E7D46`.
 * `tests/legacy-redirects.test.mjs` computes the WCAG 2.1 contrast ratio of
 * every foreground/background pair used below and asserts AA — because this
 * document is outside the design system, so nothing else would catch it drifting.
 */

export const GONE_TOKENS = {
  ground: '#FAFAF8',
  ink: '#17202A',
  /** Muted body text. Darkened from a mid grey until it cleared AA on `ground`. */
  inkMuted: '#4A5560',
  accent: '#2E7D46',
  accentInk: '#FFFFFF',
  rule: '#DCDCD4',
} as const

/** Every pair the document actually paints, so the test can assert all of them. */
export const GONE_CONTRAST_PAIRS = [
  { name: 'body text', foreground: GONE_TOKENS.ink, background: GONE_TOKENS.ground },
  { name: 'muted text', foreground: GONE_TOKENS.inkMuted, background: GONE_TOKENS.ground },
  { name: 'primary button', foreground: GONE_TOKENS.accentInk, background: GONE_TOKENS.accent },
  { name: 'secondary link', foreground: GONE_TOKENS.accent, background: GONE_TOKENS.ground },
] as const

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The requested path is echoed back so the visitor can see which link is dead.
 * It arrives from the URL, so it is untrusted: anything that is not a path is
 * dropped, the rest is escaped, and it is never placed in an attribute or a
 * script context.
 */
export function sanitizeRequestedPath(value: string | null | undefined) {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined

  const [path] = value.split(/[?#]/)
  return path.length > 1 && path.length <= 200 ? path : undefined
}

export function renderGonePage(requestedPath?: string) {
  const requested = sanitizeRequestedPath(requestedPath)
  const subject = requested ? `<code>${escapeHtml(requested)}</code>` : 'That page'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page removed - Sluglines</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: ${GONE_TOKENS.ground}; color: ${GONE_TOKENS.ink};
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6; display: flex; min-height: 100vh; align-items: center; justify-content: center;
  }
  main { max-width: 34rem; padding: 2.5rem 1.5rem; }
  .brand { font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${GONE_TOKENS.accent}; margin: 0 0 .75rem; }
  h1 { font-size: 1.875rem; line-height: 1.25; margin: 0 0 1rem; }
  p { margin: 0 0 1rem; color: ${GONE_TOKENS.inkMuted}; }
  code { background: #EFEFE9; border: 1px solid ${GONE_TOKENS.rule}; border-radius: .25rem; padding: .0625rem .375rem; font-size: .875rem; color: ${GONE_TOKENS.ink}; word-break: break-all; }
  .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.5rem; }
  a { border-radius: .5rem; padding: .75rem 1.125rem; font-weight: 700; font-size: .875rem; text-decoration: none; display: inline-block; }
  a.primary { background: ${GONE_TOKENS.accent}; color: ${GONE_TOKENS.accentInk}; }
  a.secondary { border: 1px solid ${GONE_TOKENS.rule}; color: ${GONE_TOKENS.accent}; }
  a:focus-visible { outline: 3px solid ${GONE_TOKENS.accent}; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <p class="brand">Sluglines</p>
  <h1>This page is gone for good</h1>
  <p>${subject} was part of the old Sluglines forum and is not coming back. Nothing you are looking for is hiding behind a login &mdash; the two things that carried on are below.</p>
  <div class="actions">
    <a class="primary" href="/spots">Slug pickup locations</a>
    <a class="secondary" href="/lostfound">Lost &amp; Found board</a>
  </div>
</main>
</body>
</html>
`
}
