// The server Supabase client's cookie adapter must match the installed
// `@supabase/ssr` — Docs/DECISIONS.md D-31.
//
// This test exists because the mismatch it guards against passed every other
// gate. `src/lib/supabase/server.ts` supplied `getAll`/`setAll` (the 0.5+ API) to
// a `^0.3.0` package whose `createServerClient` calls only `get`/`set`/`remove`.
// It typechecked — the options parameter is an intersection type, so TypeScript's
// excess-property check does not fire on the nested literal — it built, it
// linted, and it failed silently at runtime: no cookie was read, `auth.getUser()`
// saw no session, and every server-side client was anonymous. Nothing in the repo
// could observe that, because nothing in the repo had a session to lose.
//
// The M3 write path does. Every route under src/app/api refuses with 401 before
// it calls the database, so this adapter being wrong makes the whole write path
// unreachable for exactly the members it is for.
//
// The assertion is deliberately made against the *installed package's own type
// declaration* rather than a hard-coded list: a `@supabase/ssr` bump that renames
// the methods fails here, which is the moment the adapter needs rewriting.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const declaration = path.join(root, 'node_modules/@supabase/ssr/dist/index.d.ts')
if (!fs.existsSync(declaration)) {
  console.log('supabase-server-client: SKIPPED — @supabase/ssr is not installed')
  process.exit(0)
}

const types = fs.readFileSync(declaration, 'utf8')

// `type CookieMethods = { get?: ...; set?: ...; remove?: ... }` — the names the
// installed createServerClient will actually look for.
const block = /type CookieMethods = \{([^}]*)\}/.exec(types)
assert.notEqual(block, null, 'could not find CookieMethods in @supabase/ssr types')

const expected = [...block[1].matchAll(/^\s*(\w+)\??:/gm)].map((match) => match[1]).sort()
assert.ok(expected.length >= 1, 'CookieMethods declares no methods')

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
// reads the request cookie rather than returning a constant.
assert.match(source, /cookieStore\.get\(name\)\?\.value/, 'get() must read the request cookie')

// A Server Component cannot write cookies. Without the guard the whole render
// throws instead of falling back to the existing session.
assert.equal(
  (source.match(/catch \{\}/g) ?? []).length,
  2,
  'set() and remove() must both swallow the read-only Server Component throw'
)
