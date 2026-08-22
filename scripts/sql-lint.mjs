#!/usr/bin/env node
// =============================================================================
// sql-lint.mjs -- static security analyser for supabase/migrations/**.
//
// Enforces the rev. 5.3 default-deny posture on migration SQL *as text*. It has
// no database connection and makes no network calls; it is safe to run anywhere,
// which is the whole point (Docs/DECISIONS.md D-23).
//
// What it proves:      the SQL contains no shape that grants an anonymous or
//                      authenticated client a direct table write.
// What it does NOT
// prove:               that any policy predicate is *correct*. That needs a live
//                      Postgres and positive/negative RLS tests. See
//                      supabase/migrations/README.md, "Known limits".
//
// Rules R1..R11 are documented in supabase/migrations/README.md.
//
// Usage:
//   node scripts/sql-lint.mjs [dir]     # default dir: supabase/migrations
// Exit codes: 0 clean, 1 violations found, 2 usage/IO error.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_MIGRATIONS_DIR = 'supabase/migrations'

const MIGRATION_FILENAME = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/

const WRITE_PRIVILEGES = ['insert', 'update', 'delete', 'truncate']
const WRITE_COMMANDS = ['insert', 'update', 'delete', 'all']
const FORBIDDEN_GRANTEES = ['anon', 'public']

// R10's named exception. `public` (the pseudo-role meaning "everyone, including
// anon, unconditionally") is never exempted here: only `anon` may be granted,
// and only to a function on this list. Widening this list is a security
// decision and belongs in a reviewed migration, not a name that grew by habit,
// so it is a literal, qualified-name allowlist rather than a pattern.
//
// Entries, and what each one is allowed to expose:
//
//   get_public_spot_counts        rev. 5.3 sec.8 M1's two public aggregates.
//   get_public_open_offer_counts  Counts per active spot, nothing per member.
//
//   get_scheduled_job_health      Added 2026-08-22 for issue #46 (D-46). Not an
//                                 M1 aggregate -- it is what lets `/api/health`
//                                 report a real sweep last-run time instead of a
//                                 hardcoded null. Its whole row shape is a job
//                                 name, a cron expression, a boolean, a
//                                 timestamp and a status string; it has no
//                                 column that could carry member data. `anon` is
//                                 on it because the external uptime monitor
//                                 (#21) reads `/api/health` unauthenticated and
//                                 that route reaches the database through the
//                                 anon key.
export const ANON_CALLABLE_FUNCTIONS = new Set([
  'public.get_public_spot_counts',
  'public.get_public_open_offer_counts',
  'public.get_scheduled_job_health',
])

// -----------------------------------------------------------------------------
// Statement scanner.
//
// Hand-written rather than regex-split because a naive split on ';' breaks on
// every plpgsql function body in the file. Tracks line comments, block comments
// (nestable, per Postgres), single-quoted strings with '' escapes, and
// dollar-quoted bodies with arbitrary tags.
// -----------------------------------------------------------------------------
export function splitStatements(sql) {
  const statements = []
  let buf = ''
  let i = 0
  const n = sql.length

  while (i < n) {
    if (sql.startsWith('--', i)) {
      while (i < n && sql[i] !== '\n') i += 1
      continue
    }

    if (sql.startsWith('/*', i)) {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (sql.startsWith('/*', i)) {
          depth += 1
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth -= 1
          i += 2
        } else {
          i += 1
        }
      }
      continue
    }

    const ch = sql[i]

    if (ch === "'" || ch === '"') {
      let j = i + 1
      while (j < n) {
        if (sql[j] === ch && sql[j + 1] === ch) {
          j += 2
          continue
        }
        if (sql[j] === ch) {
          j += 1
          break
        }
        j += 1
      }
      buf += sql.slice(i, j)
      i = j
      continue
    }

    if (ch === '$') {
      const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (tagMatch) {
        const tag = tagMatch[0]
        const close = sql.indexOf(tag, i + tag.length)
        const stop = close === -1 ? n : close + tag.length
        buf += sql.slice(i, stop)
        i = stop
        continue
      }
    }

    if (ch === ';') {
      if (buf.trim()) statements.push(buf.trim())
      buf = ''
      i += 1
      continue
    }

    buf += ch
    i += 1
  }

  if (buf.trim()) statements.push(buf.trim())
  return statements
}

const flatten = (stmt) => stmt.replace(/\s+/g, ' ').trim()

// Everything before the function body, i.e. where SECURITY DEFINER / SET
// search_path legally live. Checking the header rather than the whole statement
// stops a `set search_path` inside a body from satisfying R8.
const functionHeader = (flat) => {
  const body = /\bas\s+\$/i.exec(flat)
  return body ? flat.slice(0, body.index) : flat
}

const qualify = (raw) => {
  const name = raw.replace(/"/g, '').toLowerCase()
  return name.includes('.') ? name : `public.${name}`
}

const splitRoles = (raw) =>
  raw
    .split(',')
    .map((r) => r.trim().replace(/"/g, '').replace(/^group\s+/i, '').toLowerCase())
    .filter(Boolean)

// -----------------------------------------------------------------------------
// Per-statement classification.
// -----------------------------------------------------------------------------
export function classifyStatement(statement) {
  const flat = flatten(statement)

  let m = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w".]+)/i.exec(flat)
  if (m) return { kind: 'create_table', table: qualify(m[1]), flat }

  m = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w".]+)\s+enable\s+row\s+level\s+security$/i.exec(flat)
  if (m) return { kind: 'enable_rls', table: qualify(m[1]), flat }

  m = /^create\s+policy\s+("(?:[^"]|"")*"|[\w]+)\s+on\s+([\w".]+)\s*(.*)$/i.exec(flat)
  if (m) {
    const rest = m[3] || ''
    const forClause = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(rest)
    const toClause = /\bto\s+([\w",\s]+?)(?:\s+using\b|\s+with\s+check\b|$)/i.exec(rest)
    return {
      kind: 'create_policy',
      policy: m[1].replace(/"/g, ''),
      table: qualify(m[2]),
      // Postgres defaults an omitted FOR clause to ALL, and an omitted TO clause
      // to PUBLIC. Both defaults are represented here rather than treated as
      // "unspecified", because both are the permissive reading.
      command: forClause ? forClause[1].toLowerCase() : 'all',
      roles: toClause ? splitRoles(toClause[1]) : ['public'],
      explicitRoles: Boolean(toClause),
      unconditional: /\busing\s*\(\s*true\s*\)/i.test(rest) || /\bwith\s+check\s*\(\s*true\s*\)/i.test(rest),
      flat,
    }
  }

  m = /^create\s+(?:or\s+replace\s+)?function\s+([\w".]+)\s*\(/i.exec(flat)
  if (m) {
    const header = functionHeader(flat)
    return {
      kind: 'create_function',
      fn: qualify(m[1]),
      securityDefiner: /\bsecurity\s+definer\b/i.test(header),
      pinsSearchPath: /\bset\s+search_path\s*(?:=|to)\s*\S/i.test(header),
      flat,
    }
  }

  m = /^revoke\s+(?:grant\s+option\s+for\s+)?(.+?)\s+on\s+function\s+([\w".]+)\s*\(([^)]*)\)\s+from\s+(.+?)(?:\s+(?:cascade|restrict))?$/i.exec(flat)
  if (m) {
    return { kind: 'revoke_function', privileges: m[1].toLowerCase(), fn: qualify(m[2]), roles: splitRoles(m[4]), flat }
  }

  m = /^revoke\s+(?:grant\s+option\s+for\s+)?(.+?)\s+on\s+(?:table\s+)?([\w".]+)\s+from\s+(.+?)(?:\s+(?:cascade|restrict))?$/i.exec(flat)
  if (m) {
    return { kind: 'revoke_table', privileges: m[1].toLowerCase(), table: qualify(m[2]), roles: splitRoles(m[3]), flat }
  }

  m = /^grant\s+(.+?)\s+on\s+function\s+([\w".]+)\s*\(([^)]*)\)\s+to\s+(.+?)(?:\s+with\s+grant\s+option)?$/i.exec(flat)
  if (m) {
    return { kind: 'grant_function', privileges: m[1].toLowerCase(), fn: qualify(m[2]), roles: splitRoles(m[4]), flat }
  }

  m = /^grant\s+(.+?)\s+on\s+(?:table\s+)?([\w".]+)\s+to\s+(.+?)(?:\s+with\s+grant\s+option)?$/i.exec(flat)
  if (m) {
    return { kind: 'grant_table', privileges: m[1].toLowerCase(), table: qualify(m[2]), roles: splitRoles(m[3]), flat }
  }

  return { kind: 'other', flat }
}

// -----------------------------------------------------------------------------
// Loading.
// -----------------------------------------------------------------------------
// Builds the analysed shape lintMigrations() consumes. Exported so tests can
// lint SQL fixtures held in memory -- which is how the analyser's *negative*
// cases are proven without writing bad SQL to disk.
export function analyzeSql(file, sql) {
  const named = MIGRATION_FILENAME.exec(file)
  return {
    file,
    ordinal: named ? Number(named[1]) : null,
    name: named ? named[2] : null,
    sql,
    statements: splitStatements(sql).map(classifyStatement),
  }
}

export function loadMigrations(dir) {
  if (!fs.existsSync(dir)) throw new Error(`migrations directory not found: ${dir}`)

  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort()
    .map((file) => analyzeSql(file, fs.readFileSync(path.join(dir, file), 'utf8')))
}

// -----------------------------------------------------------------------------
// Rules.
// -----------------------------------------------------------------------------
export function lintMigrations(migrations) {
  const violations = []
  const add = (rule, file, message) => violations.push({ rule, file, message })

  // R1 -- filename convention.
  for (const m of migrations) {
    if (m.ordinal === null) add('R1', m.file, 'filename must match NNNN_snake_case_name.sql')
  }

  // R2 -- ordinals unique and contiguous from 0001.
  const ordinals = migrations.map((m) => m.ordinal).filter((o) => o !== null)
  const seen = new Set()
  for (const o of ordinals) {
    if (seen.has(o)) {
      add('R2', String(o).padStart(4, '0'), `duplicate migration ordinal ${o}`)
    }
    seen.add(o)
  }
  const sorted = [...seen].sort((a, b) => a - b)
  sorted.forEach((o, idx) => {
    if (o !== idx + 1) {
      add('R2', String(o).padStart(4, '0'), `non-contiguous ordinal: expected ${idx + 1}, found ${o}`)
    }
  })

  // Cross-file fact collection: a table created in one migration may be secured
  // by a later one, so the RLS/revoke rules are evaluated over the whole set.
  const created = new Map() // table -> file
  const rlsEnabled = new Set()
  const revokedFromAnon = new Set()
  const createdFunctions = new Map() // fn -> file
  const revokedFromPublic = new Set()

  for (const m of migrations) {
    for (const s of m.statements) {
      if (s.kind === 'create_table' && !created.has(s.table)) created.set(s.table, m.file)
      if (s.kind === 'enable_rls') rlsEnabled.add(s.table)
      if (s.kind === 'revoke_table' && s.roles.includes('anon')) revokedFromAnon.add(s.table)
      if (s.kind === 'create_function' && !createdFunctions.has(s.fn)) createdFunctions.set(s.fn, m.file)
      if (s.kind === 'revoke_function' && (s.roles.includes('public') || s.roles.includes('anon'))) {
        if (s.roles.includes('public')) revokedFromPublic.add(s.fn)
      }
    }
  }

  // R3 / R11 -- every created table has RLS on and is revoked from anon.
  for (const [table, file] of created) {
    if (!rlsEnabled.has(table)) add('R3', file, `table ${table} never enables row level security`)
    if (!revokedFromAnon.has(table)) add('R11', file, `table ${table} is never revoked from anon`)
  }

  for (const m of migrations) {
    for (const s of m.statements) {
      // R4 -- no write policies at all; writes go through SECURITY DEFINER functions.
      if (s.kind === 'create_policy' && WRITE_COMMANDS.includes(s.command)) {
        add(
          'R4',
          m.file,
          `policy "${s.policy}" on ${s.table} grants ${s.command.toUpperCase()} to ${s.roles.join(', ')}; ` +
            'client writes must go through a SECURITY DEFINER function'
        )
      }

      // R5 -- policies name their roles, and never anon/public.
      if (s.kind === 'create_policy') {
        if (!s.explicitRoles) {
          add('R5', m.file, `policy "${s.policy}" on ${s.table} has no TO clause; it defaults to PUBLIC`)
        }
        for (const role of s.roles) {
          if (FORBIDDEN_GRANTEES.includes(role)) {
            add('R5', m.file, `policy "${s.policy}" on ${s.table} targets role "${role}"`)
          }
        }
      }

      // R6 -- no unconditional predicates.
      if (s.kind === 'create_policy' && s.unconditional) {
        add('R6', m.file, `policy "${s.policy}" on ${s.table} uses an unconditional true predicate`)
      }

      // R7 -- no table write privileges granted to anyone.
      if (s.kind === 'grant_table') {
        const priv = s.privileges
        const granted = priv.includes('all')
          ? ['all']
          : WRITE_PRIVILEGES.filter((p) => new RegExp(`\\b${p}\\b`).test(priv))
        if (granted.length > 0) {
          add('R7', m.file, `grant ${granted.join('/')} on ${s.table} to ${s.roles.join(', ')}`)
        }
      }

      // R8 -- SECURITY DEFINER functions pin search_path.
      if (s.kind === 'create_function' && s.securityDefiner && !s.pinsSearchPath) {
        add('R8', m.file, `SECURITY DEFINER function ${s.fn} does not pin search_path`)
      }

      // R10 -- no anonymous/public execute grants, except the named M1
      // aggregate functions in ANON_CALLABLE_FUNCTIONS (rev. 5.3 sec.8 M1).
      // `public` is never exempt, on any function: it is the pseudo-role
      // Postgres treats as "everyone, unconditionally," which is broader than
      // the specific `anon` role the exception is scoped to.
      if (s.kind === 'grant_function') {
        for (const role of s.roles) {
          if (role === 'public' && FORBIDDEN_GRANTEES.includes(role)) {
            add('R10', m.file, `grant execute on ${s.fn} to "${role}"`)
          } else if (role === 'anon' && !ANON_CALLABLE_FUNCTIONS.has(s.fn)) {
            add('R10', m.file, `grant execute on ${s.fn} to "${role}"`)
          }
        }
      }
    }
  }

  // R9 -- every created function is revoked from PUBLIC.
  //
  // The load-bearing rule: Postgres grants EXECUTE on a new function to PUBLIC by
  // default, so without this a SECURITY DEFINER writer is anonymously callable no
  // matter how strict the table policies are.
  for (const [fn, file] of createdFunctions) {
    if (!revokedFromPublic.has(fn)) {
      add('R9', file, `function ${fn} is never revoked from PUBLIC (Postgres grants EXECUTE to PUBLIC by default)`)
    }
  }

  return violations
}

export function lintDirectory(dir = DEFAULT_MIGRATIONS_DIR) {
  return lintMigrations(loadMigrations(dir))
}

// -----------------------------------------------------------------------------
// CLI.
// -----------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  const dir = process.argv[2] || DEFAULT_MIGRATIONS_DIR
  let migrations
  try {
    migrations = loadMigrations(dir)
  } catch (err) {
    console.error(`sql-lint: ${err.message}`)
    process.exit(2)
  }

  const violations = lintMigrations(migrations)
  const statementCount = migrations.reduce((acc, m) => acc + m.statements.length, 0)

  if (violations.length === 0) {
    console.log(`sql-lint: ${migrations.length} migration(s), ${statementCount} statement(s), 0 violations.`)
    console.log('sql-lint: static shape check only -- this does not verify RLS behaviour.')
    process.exit(0)
  }

  console.error(`sql-lint: ${violations.length} violation(s) in ${dir}\n`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.message}`)
  }
  console.error('\nRules are documented in supabase/migrations/README.md')
  process.exit(1)
}
