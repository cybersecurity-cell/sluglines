#!/usr/bin/env node
/**
 * audit-check.mjs — dependency audit gate with a documented exceptions mechanism.
 *
 * Runs `npm audit --json`, collects every advisory at or above the severity
 * threshold, and fails unless each one is covered by a non-expired entry in
 * `.github/audit-exceptions.json`.
 *
 * Exit codes:
 *   0  no unwaived findings at/above threshold, and no expired exceptions
 *   1  unwaived findings, or an exception past its expiry date
 *   2  the audit itself could not be run/parsed
 *
 * Usage:
 *   node scripts/audit-check.mjs [--level=high] [--exceptions=<path>]
 *
 * Rationale for the exceptions file rather than a blanket `--audit-level`:
 * a waiver must name the advisory, say why it is accepted, and expire. An
 * expired waiver fails the build, which forces a re-review instead of letting
 * an accepted risk become permanent silently.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical']

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const args = { level: 'high', exceptions: '.github/audit-exceptions.json' }
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) args[match[1]] = match[2]
  }
  return args
}

/** `npm audit` exits non-zero when it finds anything, so capture output either way. */
function runAudit() {
  try {
    return execFileSync('npm', ['audit', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    })
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.trim()) return error.stdout
    throw error
  }
}

/**
 * Flatten npm's per-package tree into a unique set of advisories. Keying on the
 * GHSA id (rather than the package entry) avoids double-counting the same
 * advisory reached through several dependency paths.
 */
function collectAdvisories(report, minSeverity) {
  const threshold = SEVERITY_ORDER.indexOf(minSeverity)
  const found = new Map()

  for (const entry of Object.values(report.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via !== 'object') continue
      if (SEVERITY_ORDER.indexOf(via.severity) < threshold) continue

      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? `${via.name}@${via.source}`
      if (!found.has(id)) {
        found.set(id, { id, package: via.name, severity: via.severity, title: via.title, url: via.url })
      }
    }
  }
  return [...found.values()]
}

function loadExceptions(file) {
  const abs = path.resolve(repoRoot, file)
  if (!existsSync(abs)) return { exceptions: [] }
  return JSON.parse(readFileSync(abs, 'utf8'))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!SEVERITY_ORDER.includes(args.level)) {
    console.error(`audit-check: unknown severity level "${args.level}"`)
    process.exit(2)
  }

  let report
  try {
    report = JSON.parse(runAudit())
  } catch (error) {
    console.error(`audit-check: could not run or parse "npm audit --json": ${error.message}`)
    process.exit(2)
  }

  const { exceptions = [] } = loadExceptions(args.exceptions)
  // Compare dates, not timestamps: an entry expires at the end of its stated day.
  const today = new Date().toISOString().slice(0, 10)

  const expired = exceptions.filter((e) => !e.expires || e.expires < today)
  const active = exceptions.filter((e) => e.expires && e.expires >= today)

  const advisories = collectAdvisories(report, args.level)
  const waived = []
  const unwaived = []

  for (const advisory of advisories) {
    const match = active.find((e) => e.advisory === advisory.id || (e.package && e.package === advisory.package))
    if (match) waived.push({ advisory, exception: match })
    else unwaived.push(advisory)
  }

  const counts = report.metadata?.vulnerabilities ?? {}
  console.log(`audit-check: threshold=${args.level}`)
  console.log(`audit-check: npm audit totals ${JSON.stringify(counts)}`)
  console.log(`audit-check: ${advisories.length} advisories at/above threshold; ${waived.length} waived, ${unwaived.length} unwaived`)

  if (waived.length) {
    console.log('\nWaived (documented exceptions):')
    for (const { advisory, exception } of waived) {
      console.log(`  - ${advisory.id} ${advisory.package} (${advisory.severity}) expires ${exception.expires} — ${exception.reason}`)
    }
  }

  if (expired.length) {
    console.error('\nEXPIRED exceptions (re-review required — these no longer waive anything):')
    for (const e of expired) {
      console.error(`  - ${e.advisory ?? e.package}: expired ${e.expires ?? '(no expiry set)'} — ${e.reason}`)
    }
  }

  if (unwaived.length) {
    console.error(`\nUNWAIVED advisories at/above ${args.level}:`)
    for (const a of unwaived) {
      console.error(`  - ${a.id} ${a.package} (${a.severity}) — ${a.title}`)
      console.error(`    ${a.url}`)
    }
    console.error('\nFix the dependency, or add a dated entry to .github/audit-exceptions.json with a reason.')
  }

  const failed = unwaived.length > 0 || expired.length > 0
  console.log(`\naudit-check: ${failed ? 'FAIL' : 'PASS'}`)
  process.exit(failed ? 1 : 0)
}

main()
