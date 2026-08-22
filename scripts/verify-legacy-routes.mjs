#!/usr/bin/env node

// Issue #23 — check all 165 legacy routes against a deployed origin.
//
// tests/legacy-redirects.test.mjs already proves the *policy* is right. This
// proves the *edge* agrees with it: the middleware matcher, Vercel's routing
// layer and the deployed build, which are three things a unit test cannot see.
// "A redirect map that is correct in a unit test and wrong at the edge is the
// failure this catches" — the issue's own words.
//
// The expectation for every path comes from classifyLegacyPath(), the same
// function the middleware calls. That is deliberate: this script is not a second
// copy of the policy that could drift from it, it is the policy checked against
// reality. What it can catch is exactly what the unit test cannot — a matcher
// that excludes a path, a rewrite that loses its status, an origin that answers
// before the middleware runs.
//
// Usage:
//   node scripts/verify-legacy-routes.mjs <origin> [--token=<vercel share token>]
//
// The token is only needed while the deployment sits behind Vercel Authentication
// (#47). It is appended as a query parameter and does not affect path matching;
// redirects are NOT followed, so the token is never needed for a second hop.
//
// Exit 0 only when every route matches. Node built-ins plus the repo's own policy.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GONE, GONE_PATH, MOVED_PERMANENTLY, classifyLegacyPath } from '../src/lib/legacy-redirects.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const origin = args.find((a) => !a.startsWith('--'))
const token = (args.find((a) => a.startsWith('--token=')) ?? '').replace('--token=', '')
const concurrency = Number((args.find((a) => a.startsWith('--concurrency=')) ?? '').replace('--concurrency=', '')) || 8

if (!origin) {
  console.error('usage: node scripts/verify-legacy-routes.mjs <origin> [--token=…] [--concurrency=N]')
  process.exit(1)
}

const inventory = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/legacy-site-content.json'), 'utf8')
)
const routes = inventory.routes.map((route) => route.path)

/** What the deployed edge should do with this path, per the committed policy. */
function expectation(pathname) {
  const disposition = classifyLegacyPath(pathname)

  if (disposition.kind === 'redirect') {
    return { status: disposition.status ?? MOVED_PERMANENTLY, location: disposition.target }
  }
  if (disposition.kind === 'gone') {
    // A rewrite, not a redirect: the dead URL stays in the address bar and in the
    // crawler's log, and the response itself carries 410.
    return { status: GONE, location: null, rewriteOf: GONE_PATH }
  }
  return { status: 200, location: null }
}

// Vercel Authentication (#47) answers an unauthenticated request with a 307 to
// itself and a cookie. Passing `_vercel_share` on every request would therefore
// make every 200-expecting route look like a 307 — the token is exchanged once,
// for a cookie, and the cookie is what the real checks carry. Redirects are still
// never followed, so a 301 under test is observed rather than chased.
let authCookie = ''

async function establishSession() {
  if (!token) return
  const url = new URL('/', origin)
  url.searchParams.set('_vercel_share', token)
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
  const cookies = res.headers.getSetCookie?.() ?? []
  authCookie = cookies.map((c) => c.split(';')[0]).join('; ')
  if (!authCookie) {
    console.error('warning: share token produced no cookie; 200-expecting routes will report the SSO 307')
  }
}

async function hop(pathname) {
  const res = await fetch(new URL(pathname, origin), {
    redirect: 'manual',
    headers: authCookie ? { cookie: authCookie } : {},
    signal: AbortSignal.timeout(30000),
  })
  const location = res.headers.get('location')
  return { status: res.status, location: location ? new URL(location, origin).pathname : null }
}

/**
 * An old bookmark is followed, not inspected one hop at a time, so this follows
 * the chain and asserts where it lands as well as how it got there.
 *
 * Every path in the inventory carries WordPress's trailing slash. Next
 * canonicalises those with a 308 to the slash-less form (`trailingSlash: false`),
 * so most legacy URLs resolve in two hops rather than one. That is correct
 * behaviour and permanent, not a fault — but it is a real difference between the
 * committed policy and the deployed edge, which is the class of thing this check
 * exists to surface, so it is counted and reported rather than absorbed.
 */
async function check(pathname) {
  const expected = expectation(pathname)
  const chain = []

  try {
    let current = pathname
    let canonicalised = false

    for (let i = 0; i < 4; i += 1) {
      const result = await hop(current)
      chain.push({ from: current, ...result })

      const isTrailingSlashCanonicalisation =
        result.status === 308 &&
        current.endsWith('/') &&
        current !== '/' &&
        result.location === current.replace(/\/+$/, '')

      if (isTrailingSlashCanonicalisation) {
        canonicalised = true
        current = result.location
        continue
      }

      const statusOk = result.status === expected.status
      const locationOk =
        expected.location === null
          ? true
          : result.location === new URL(expected.location, origin).pathname

      return { pathname, ok: statusOk && locationOk, expected, actual: result, chain, canonicalised }
    }

    return { pathname, ok: false, expected, actual: { status: 0, location: null, error: 'redirect loop' }, chain, canonicalised }
  } catch (error) {
    return {
      pathname,
      ok: false,
      expected,
      actual: { status: 0, location: null, error: error instanceof Error ? error.message : 'unknown' },
      chain,
      canonicalised: false,
    }
  }
}

await establishSession()

const results = []
const queue = [...routes]

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const pathname = queue.shift()
      if (pathname === undefined) return
      results.push(await check(pathname))
    }
  })
)

results.sort((a, b) => a.pathname.localeCompare(b.pathname))

const failures = results.filter((result) => !result.ok)
const byStatus = results.reduce((acc, result) => {
  const key = `${result.expected.status}`
  acc[key] = (acc[key] ?? 0) + 1
  return acc
}, {})

const canonicalised = results.filter((result) => result.canonicalised).length

console.log(`origin: ${origin}`)
console.log(`routes checked: ${results.length} of ${inventory.totals.routes} in the inventory`)
console.log(`expected dispositions: ${Object.entries(byStatus).map(([s, n]) => `${n}×${s}`).join(', ')}`)
console.log(`trailing-slash canonicalisation (308 to the slash-less path): ${canonicalised}`)

for (const failure of failures) {
  console.log(
    `FAIL ${failure.pathname}\n` +
      `      expected ${failure.expected.status}` +
      `${failure.expected.location ? ` -> ${failure.expected.location}` : ''}\n` +
      `      actual   ${failure.actual.status}` +
      `${failure.actual.location ? ` -> ${failure.actual.location}` : ''}` +
      `${failure.actual.error ? ` (${failure.actual.error})` : ''}`
  )
}

console.log(`\nPASS=${results.length - failures.length} FAIL=${failures.length}`)

if (failures.length > 0 || results.length !== inventory.totals.routes) {
  process.exitCode = 1
}
