import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync('src/app/how-it-works/page.tsx', 'utf8')

// Comments stripped for the assertions that forbid a pattern. The comment
// explaining WHY the legacy host was removed necessarily names that host, and a
// naive scan of the raw file reads its own explanation as the offence — the same
// trap tests/domain-boundaries.test.mjs hit. Prose assertions below still read
// the raw source, because a caption living only in a comment is also a defect.
const pageCode = pageSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

assert.ok(pageSource.includes('How Slugging Works'))
assert.equal(pageSource.includes('HowSlugging Works'), false)
assert.equal(pageSource.includes('Ã'), false)
assert.equal(pageSource.includes('Â'), false)

// This block used to assert those three `sluglines.com/wp-content/uploads/…`
// URLs were PRESENT, which pinned the defect in place: the page hotlinked
// decorative photographs from the legacy WordPress host, so the live site
// depended on the site being decommissioned. At the #25 DNS cutover those URLs
// stop resolving and the page silently loses its images; they also violated the
// app's own `img-src 'self' data: blob:` (D-48), and re-hosting them is blocked
// on the third-party rights review in #39.
//
// Found by tests/e2e/console.spec.ts on its first run (#35) — three
// ERR_TUNNEL_CONNECTION_FAILED entries. The assertion is now the other way
// round, and covers the whole host rather than three known paths.
// A plain substring, not a regex. An unanchored host pattern is a real smell when
// it validates a URL — CodeQL flags exactly that — and here a regex bought
// nothing over `includes` anyway. This is a "must not appear anywhere in the
// source" check, so scanning for the literal is both clearer and correct.
assert.equal(
  pageCode.includes('sluglines.com/wp-content'),
  false,
  'how-it-works must not hotlink the legacy WordPress host: those URLs die at the #25 cutover'
)
assert.equal(
  /<img\s/.test(pageCode),
  false,
  'no raw <img> here — the visual steps are icon-only, and next/image is the route for real imagery'
)

for (const caption of [
  'Riders line up at known pickup spots.',
  'Drivers call out or display their destination.',
  'Riders heading that way get in and everyone saves time.',
]) {
  assert.ok(pageSource.includes(caption), `Missing visual caption ${caption}`)
}
