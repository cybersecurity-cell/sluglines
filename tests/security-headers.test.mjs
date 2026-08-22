// Browser security headers — issue #33, risk 15 in §14.
//
// This baseline existed once. `codex/phase-1`'s own `Docs/security-review.md`
// listed CSP, frame denial, MIME-sniffing prevention, restricted referrers and
// denied camera/microphone/geolocation as *shipped* controls — and then the
// branch was abandoned (#11) and `next.config.js` went back to three lines with
// no `headers()` at all. So the point of this file is not to check that someone
// wrote the headers today; it is that deleting them fails a gate tomorrow.
//
// The policy is asserted as data, from the module Next actually imports, rather
// than by string-matching the config.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  CSP_REPORT_ONLY,
  CSP_REPORT_PATH,
  contentSecurityPolicy,
  securityHeaders,
} from '../src/lib/security-headers.mjs'

const root = process.cwd()
const config = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8')

// --- Next is actually told to send them --------------------------------------
// The module could be perfect and unreferenced. That is the failure mode the
// original loss looked like from the outside.
assert.match(config, /async headers\(\)/, 'next.config.js defines headers()')
assert.match(config, /securityHeaders\(\)/, 'and sources them from the tested module')
assert.match(config, /source: '\/:path\*'/, 'applied to every path, including the ones middleware skips')

const headers = securityHeaders()
const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]))

// --- the four that are safe to enforce immediately (#33 bullet 1) ------------
assert.equal(byKey['X-Content-Type-Options'], 'nosniff')
assert.equal(byKey['X-Frame-Options'], 'DENY')
assert.match(byKey['Referrer-Policy'], /^strict-origin-when-cross-origin$/)

for (const denied of ['camera', 'microphone', 'geolocation']) {
  assert.match(
    byKey['Permissions-Policy'],
    new RegExp(`${denied}=\\(\\)`),
    `${denied} is denied outright, not merely restricted to self`
  )
}

// --- the CSP ships report-only, and says so in the header name ---------------
// #33 sequences it this way on purpose: an enforced policy that is wrong breaks
// the page it protects. The name is derived from the flag, so flipping the flag
// is the whole of the enforcement change.
const cspKey = CSP_REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
assert.ok(byKey[cspKey], `the CSP is sent as ${cspKey}`)
assert.equal(
  Object.hasOwn(byKey, CSP_REPORT_ONLY ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'),
  false,
  'exactly one of the two CSP header names is sent, never both'
)

// A report-only policy with nowhere to report is decorative — the violations
// land in visitors' consoles where nobody doing the inventory will see them.
assert.match(byKey[cspKey], new RegExp(`report-uri ${CSP_REPORT_PATH}`), 'violations have a collector')
assert.match(byKey['Reporting-Endpoints'], new RegExp(CSP_REPORT_PATH), 'and the modern reporting header agrees')
assert.equal(
  fs.existsSync(path.join(root, 'src/app/api/csp-report/route.ts')),
  true,
  'and the collector exists'
)

// --- the directives that carry the actual protection -------------------------
const csp = contentSecurityPolicy()
for (const directive of [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
]) {
  assert.ok(csp.includes(directive), `CSP must carry: ${directive}`)
}

// --- the weakenings are bounded, and script-src is the one that matters ------
// `connect-src https:` or a bare `*` would let a CSP look strict while permitting
// exfiltration to any host. That is the single most common way these policies
// are written wrong, so it is asserted rather than assumed.
const connectSrc = /connect-src ([^;]+)/.exec(csp)[1]
assert.ok(connectSrc.includes("'self'"))
for (const wildcard of ['https:', 'http:', '*']) {
  assert.equal(
    connectSrc.split(/\s+/).includes(wildcard),
    false,
    `connect-src must name real origins, never the ${wildcard} wildcard`
  )
}

// `'unsafe-inline'` in script-src is a known, recorded weakening: Next injects an
// inline bootstrap and there is no nonce path yet. It is exactly why the policy
// is still report-only, so enforcing while it is still there would buy the
// breakage without the protection. This assertion is the tripwire on that.
const scriptSrc = /script-src ([^;]+)/.exec(csp)[1]
if (scriptSrc.includes("'unsafe-inline'")) {
  assert.equal(
    CSP_REPORT_ONLY,
    true,
    "script-src still allows 'unsafe-inline', so the CSP must not be enforced yet (#33 bullet 3)"
  )
}

assert.equal(csp.includes("object-src 'none'"), true)

console.log(
  `security headers: ${headers.length} sent, CSP ${CSP_REPORT_ONLY ? 'report-only' : 'ENFORCED'}, ` +
    `connect-src pinned to named origins`
)
