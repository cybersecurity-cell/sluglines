/**
 * Whether a request's host should be told not to index.
 *
 * `sluglines.org` is a temporary testing surface (owner directive,
 * 2026-09-05): `sluglines.com` remains canonical, `.org` will 301 to `.com`
 * once development completes, and no SEO or backlink behaviour may accrue to
 * `.org` in the meantime — a crawler that indexed the test domain would
 * compete with the real one, which still serves the old WordPress site.
 *
 * This guards `sluglines.com`; it is not SEO for `.org`. `src/middleware.ts`
 * applies it as `X-Robots-Tag: noindex, nofollow` on every non-canonical
 * host. Delete `CANONICAL_HOSTS`, this function and the middleware call site
 * once `.org` itself 301s to `.com` — there will be nothing left to guard.
 *
 * Takes the raw `Host` header rather than `NextRequest.nextUrl.hostname`:
 * under a self-hosted `next start` (no Vercel edge in front), `nextUrl`
 * resolves to the server's own bind address, not what the client sent, which
 * would silently defeat this guard outside of Vercel. The `Host` header is
 * what the client actually sent on every runtime.
 */
export const CANONICAL_HOSTS = new Set(['sluglines.com', 'www.sluglines.com'])

export function shouldNoIndex(rawHost: string | null): boolean {
  const hostname = (rawHost ?? '').split(':')[0].toLowerCase()
  return !CANONICAL_HOSTS.has(hostname)
}
