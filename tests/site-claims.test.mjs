// Issue #142 — claims the site makes that must stay true, pinned in source:
// the README describes this stack and not the 2018 counter app; the /app page
// says what it is; the footer offers only routes that exist under the names
// they have; the home page's metadata says what the site is; /blog and /news
// are two views of the archive, not one list under two names; Docs/intent/
// exists with one file per feature in flight.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { getRelatedLegacyPosts, isNewsPost } from '../src/lib/legacy-posts.ts'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

// --- README ----------------------------------------------------------------------
const readme = read('README.md')
for (const stale of ['Next.js 14', 'real-time subscriptions', 'iOS and Android apps', 'React Native', 'spot_status', 'RealTimeBoard', 'reset_daily_counts']) {
  assert.equal(readme.includes(stale), false, `README must not claim "${stale}"`)
}
assert.match(readme, /Next\.js 16/, 'the README names the framework version the lockfile has')
assert.match(readme, /No mobile app/, 'the README says there is no mobile app')
assert.match(readme, /No live updates/, 'the README says there is no Realtime')
assert.match(readme, /AGENTS\.md/, 'the README points at the contract')
for (const gate of ['npm run test', 'npm run lint', 'npm run typecheck', 'npm run build', 'npm run sql:check', 'npm run e2e']) {
  assert.ok(readme.includes(gate), `the README lists the gate ${gate}`)
}
assert.equal(/bwpguotjzczmieeepczf/.test(readme), false, 'the README never prints the production project ref')

// --- /app: preserved, and says so ------------------------------------------------
const appPage = read('src/app/app/page.tsx')
assert.match(appPage, /notice="This page is preserved from the 2018 Sluglines site\. The iOS and Android apps it describes are no longer maintained or available\./, '/app carries a present-tense qualifier')
const legacyPage = read('src/components/LegacyContentPage.tsx')
assert.match(legacyPage, /notice\?: string/, 'LegacyContentPage accepts a notice')
assert.match(legacyPage, /role="note"/, 'and renders it as a note above the preserved body')
assert.match(legacyPage, /dangerouslySetInnerHTML=\{\{ __html: safeContentHtml \}\}/, 'the body itself is still the migrated HTML, unedited')

// --- footer ----------------------------------------------------------------------
const layout = read('src/app/layout.tsx')
assert.equal(/REGISTER/.test(layout), false, 'phone sign-in has no separate registration; the footer must not advertise one')
assert.equal(/metroshutdown-2019/.test(layout), false, 'a 2019 event is not a quick link')
assert.match(layout, /href="\/lostfound"/, 'Lost & Found is the quick link in its place')
assert.match(layout, /href="mailto:admin@sluglines\.com"/, 'the contact address is a mailto link')
assert.match(layout, /SIGN IN/, 'the footer names the one identity action the site has')

// --- home metadata ---------------------------------------------------------------
const home = read('src/app/page.tsx')
assert.match(home, /HOME_TITLE = 'Sluglines - Slug lines and HOV-3 carpools in Northern Virginia'/, 'the home title says what the site is')
assert.equal(/title: 'Sluglines - Connecting drivers and riders for better commute'/.test(home), false, 'the legacy tagline is not the page title')
assert.match(home, /\.\.\.\(homePage \? buildLegacyMetadata\(homePage\) : \{\}\)/, 'canonical and Open Graph shape still come from the legacy metadata builder')

const dashboard = read('src/app/dashboard/page.tsx')
assert.equal(/live rider and driver counts/.test(dashboard), false, 'the dashboard counts are per-request aggregates, not live')

// --- blog vs news ---------------------------------------------------------------
const news = getRelatedLegacyPosts('news', 1000)
const blog = getRelatedLegacyPosts('blog', 1000)
assert.ok(news.length >= 6, `news must still have a page of posts, got ${news.length}`)
assert.ok(blog.length >= 6, `blog must still have a page of posts, got ${blog.length}`)
const newsPaths = new Set(news.map((post) => post.path))
assert.equal(blog.some((post) => newsPaths.has(post.path)), false, 'no post appears on both /blog and /news')
assert.ok(news.every(isNewsPost) && blog.every((post) => !isNewsPost(post)), 'the split is exactly isNewsPost')
assert.ok(news.some((post) => /metro/i.test(post.title)), 'Metro work is news')

// --- the duplicate rules path is an alias, deliberately ---------------------------
assert.match(read('src/app/slugging-rules-and-etiquette/page.tsx'), /export \{ metadata, default \} from '@\/app\/slugging-rules\/page'/, 'the legacy rules URL is served as an alias of the one page, not a second copy')

// --- Docs/intent ----------------------------------------------------------------
const intentDir = path.join(root, 'Docs/intent')
assert.equal(fs.existsSync(intentDir), true, 'Docs/intent/ exists (AGENTS.md: one file per feature in flight)')
const intents = fs.readdirSync(intentDir).filter((name) => name.endsWith('.md'))
assert.ok(intents.length >= 3, `expected the three features in flight, got ${intents.length}`)
for (const name of intents) {
  const doc = read(`Docs/intent/${name}`)
  for (const heading of ['## Why', '## Decisions', '## Invariants', '## Done']) {
    assert.ok(doc.includes(heading), `Docs/intent/${name} carries the ${heading} section AGENTS.md asks for`)
  }
  assert.match(doc, /\*Rejected:\*/, `Docs/intent/${name} records rejected alternatives`)
}

console.log('site-claims: ok')
