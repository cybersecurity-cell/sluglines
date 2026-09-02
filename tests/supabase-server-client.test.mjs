// The server Supabase client's cookie adapter must match the installed
// `@supabase/ssr` — Docs/DECISIONS.md D-31.
//
// This test exists because the mismatch it guards against passed every other
// gate. `src/lib/supabase/server.ts` once supplied `getAll`/`setAll` (the 0.5+
// API) to a `^0.3.0` package whose `createServerClient` called only
// `get`/`set`/`remove`. It typechecked — the options parameter is an
// intersection type, so TypeScript's excess-property check does not fire on
// the nested literal — it built, it linted, and it failed silently at
// runtime: no cookie was read, `auth.getUser()` saw no session, and every
// server-side client was anonymous. Nothing in the repo could observe that,
// because nothing in the repo had a session to lose.
//
// The M3 write path does. Every route under src/app/api refuses with 401
// before it calls the database, so this adapter being wrong makes the whole
// write path unreachable for exactly the members it is for.
//
// The assertion is deliberately made against the *installed package's own type
// declaration* rather than a hard-coded list: a `@supabase/ssr` bump that renames
// the methods fails here, which is the moment the adapter needs rewriting.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pkgDir = path.join(root, 'node_modules/@supabase/ssr')

if (!fs.existsSync(pkgDir)) {
  console.log('supabase-server-client: SKIPPED — @supabase/ssr is not installed')
  process.exit(0)
}

function findDeclarationFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findDeclarationFiles(full)
    return entry.name.endsWith('.d.ts') ? [full] : []
  })
}

// Scanned rather than fixed to `dist/index.d.ts`: the installed 0.12.x layout
// keeps its types in `dist/module/types.d.ts`, and this way a future reshuffle
// of the package's own file layout does not itself make the test SKIP.
const declarationFiles = findDeclarationFiles(path.join(pkgDir, 'dist'))
const found = declarationFiles
  .map((file) => ({ file, types: fs.readFileSync(file, 'utf8') }))
  .find(({ types }) => /type CookieMethodsServer = \{/.test(types))

assert.notEqual(found, undefined, 'could not find CookieMethodsServer in @supabase/ssr types')

const block = /type CookieMethodsServer = \{([^}]*)\}/.exec(found.types)
assert.notEqual(block, null, 'could not find CookieMethodsServer in @supabase/ssr types')

// Only properties typed as a `*Cookies` callback alias (`GetAllCookies`,
// `SetAllCookies`, ...) are cookie methods. `CookieMethodsServer` also
// declares `encode?: "user-and-tokens" | "tokens-only"`, a config flag rather
// than a method the adapter implements — a plain "every property name" scrape
// would wrongly demand an `encode()` function from the adapter.
const expected = [...block[1].matchAll(/^\s*(\w+)\??:\s*\w*Cookies\b/gm)].map((match) => match[1]).sort()
assert.ok(expected.length >= 1, 'CookieMethodsServer declares no cookie-callback methods')

const source = fs.readFileSync(path.join(root, 'src/lib/supabase/server.ts'), 'utf8')

// The adapter object passed as `cookies: { ... }`.
const adapter = /cookies:\s*\{([\s\S]*?)\n {6}\},/.exec(source)
assert.notEqual(adapter, null, 'could not find the cookies adapter in src/lib/supabase/server.ts')

const implemented = [...adapter[1].matchAll(/^\s{8}(\w+)\(/gm)].map((match) => match[1]).sort()

assert.deepEqual(
  implemented,
  expected,
  `src/lib/supabase/server.ts implements [${implemented}] but the installed ` +
    `@supabase/ssr calls [${expected}]. Methods it does not call are ignored ` +
    'silently, which leaves every server client anonymous.'
)

// The read path is the one that matters for authentication; assert it actually
// reads the request's cookie jar rather than returning a constant.
assert.match(source, /return cookieStore\.getAll\(\)/, 'getAll() must read the request cookie jar')

// A Server Component cannot write cookies. Without the guard the whole render
// throws instead of falling back to the existing session.
assert.equal(
  (source.match(/catch \{\}/g) ?? []).length,
  1,
  'setAll() must swallow the read-only Server Component throw'
)

// `cookies()` from `next/headers` is async as of Next 15+; a synchronous call
// still works today (it warns, then breaks in a future major) but the whole
// point of this migration is not to leave that trap in the tree.
assert.match(source, /await cookies\(\)/, 'cookies() must be awaited under the async dynamic APIs')
assert.match(
  source,
  /export async function createClient/,
  'createClient must be async: it awaits cookies(), so every caller must await it too'
)
