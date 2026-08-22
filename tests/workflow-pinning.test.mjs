// Every GitHub Action is commit-pinned — issue #34, risk 16 in §14.
//
// The workflows in this repository are not incidental: gitleaks, CodeQL, audit,
// test and build gate every merge into `main`. Pinning them to a mutable tag
// means that gate runs code which can change under it with no diff here — the
// same supply-chain shape the `audit` job exists to catch in npm dependencies,
// left open in the layer directly above it.
//
// This was recorded as a shipped control once before. `codex/phase-1`'s
// `Docs/security-review.md` claimed "first-party GitHub actions are
// commit-pinned"; the branch was abandoned and the claim stopped being true
// without anything failing (#11). So this is a gate, not a checklist.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workflowDir = path.join(root, '.github/workflows')

const workflows = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))
assert.ok(workflows.length >= 4, 'expected the CI, audit, secret-scan and static-analysis workflows')

const USES = /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm
const FULL_SHA = /^[0-9a-f]{40}$/

let pinned = 0

for (const file of workflows) {
  const source = fs.readFileSync(path.join(workflowDir, file), 'utf8')

  for (const [, ref, trailing] of source.matchAll(USES)) {
    // A local composite action (`./.github/actions/x`) has no ref to pin and is
    // this repository's own code, already covered by the diff.
    if (ref.startsWith('./')) continue

    const [action, version] = [ref.slice(0, ref.lastIndexOf('@')), ref.slice(ref.lastIndexOf('@') + 1)]
    assert.ok(action, `${file}: "uses: ${ref}" has no action name`)

    assert.match(
      version,
      FULL_SHA,
      `${file}: ${action} is pinned to "${version}". Every action must be pinned to a full ` +
        '40-character commit SHA — a tag is repointable by whoever owns that repository, and these ' +
        'workflows gate every merge into main.'
    )

    // A bare SHA is unreadable, and unreadable pins are the ones that never get
    // updated because nobody can tell how old they are. The trailing comment is
    // what Dependabot rewrites alongside the SHA.
    assert.match(
      trailing,
      /#\s*v\d+(\.\d+)*/,
      `${file}: ${action}@${version.slice(0, 7)} must carry a "# vN.N.N" comment naming the version`
    )

    pinned += 1
  }
}

assert.ok(pinned >= 10, `expected every workflow step to be checked; only saw ${pinned}`)

// --- and the pins are kept current (#34 bullet 3) ----------------------------
// Pinning freezes the action, so an upstream security fix never arrives unless
// something opens the PR. Without this, closing #34 would trade one
// supply-chain problem for a quieter one.
const dependabot = path.join(root, '.github/dependabot.yml')
assert.equal(fs.existsSync(dependabot), true, '.github/dependabot.yml must exist to move the pins')

const config = fs.readFileSync(dependabot, 'utf8')
assert.match(config, /package-ecosystem:\s*github-actions/, 'dependabot must watch github-actions')

console.log(`workflow pinning: ${pinned} action refs across ${workflows.length} workflows, all SHA-pinned`)
