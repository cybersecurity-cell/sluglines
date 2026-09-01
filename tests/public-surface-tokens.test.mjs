// The §10 design system, as it lands on the public marketing surface.
//
// These are source-level assertions, and the reason they are worth having is the
// same reason `tests/public-directory-ui.test.mjs` gives for its own: they pin
// the things a later edit undoes silently. A palette migration fails in a
// specific way — one component keeps the retired colour, one grey slips back
// under the contrast floor, one number gets recomputed in a second place and
// drifts — and none of those turn a page red or throw. They just look slightly
// wrong to someone who is not looking.
//
// What this file does NOT claim: that the page looks good, or that a rendered
// tree is accessible. `tests/e2e/accessibility.spec.ts` runs axe over the real
// DOM and `tests/theme-contrast.test.mjs` runs the ratios. This is the third
// leg — the one that reads the source.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { PAIRS } from '../scripts/contrast-check.mjs'
import { RESOURCE_MODULES } from '../src/lib/site-content.ts'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

// The files the §10 redesign migrated.
//
// The first block is the homepage slice (D-62). The second is the rest of the
// public surface: the directory pages, the spot detail page, the legacy archive
// frames, and the marketing pages. Adding a file here is what makes the
// migration enforced rather than hoped — the sky-* and slate-950 scans below
// walk this list, so a page that is not in it is a page that can quietly go
// back.
const REDESIGNED = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/components/SiteHero.tsx',
  'src/components/CorridorStatusStrip.tsx',
  'src/components/SpotDirectorySection.tsx',
  'src/components/InfoModuleGrid.tsx',
  'src/components/RecentPostsSection.tsx',
  'src/components/Navbar.tsx',

  'src/app/spots/page.tsx',
  'src/app/slug_pickup/page.tsx',
  'src/app/lostfound/page.tsx',
  'src/app/slugging-rules/page.tsx',
  'src/app/how-it-works/page.tsx',
  'src/components/SpotSearch.tsx',
  'src/components/SpotDetailLayout.tsx',
  'src/components/SpotQuickFacts.tsx',
  'src/components/SpotLiveCounts.tsx',
  'src/components/CommunityLinksCard.tsx',
  'src/components/LegacyContentPage.tsx',
  'src/components/PostIndexPage.tsx',
]

const source = Object.fromEntries(REDESIGNED.map((file) => [file, read(file)]))

/**
 * Comments are prose about the code, not the code. A migration note that says
 * "this used to be sky-700" is the opposite of a leftover, and a gate that fails
 * on the explanation is a gate that teaches people to delete the explanation.
 *
 * Line comments are only stripped when they START a line, so the `//` in
 * `https://google.com/maps` survives — those URLs are real behaviour.
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const code = Object.fromEntries(REDESIGNED.map((file) => [file, stripComments(source[file])]))

// --- the retired palette is gone, not merely covered up ---------------------

// `sky-*` was the brand chrome before §10. A migration that leaves one button
// or one active nav pill behind is the half-migrated state this checks for.
// Matched on the utility prefix so `bg-sky-700`, `text-sky-800`, `border-sky-200`
// and `hover:bg-sky-50` are all caught.
for (const [file, text] of Object.entries(code)) {
  const leftovers = [...text.matchAll(/[\w:[-]*\bsky-\d{2,3}\b/g)].map((m) => m[0])
  assert.deepEqual(leftovers, [], `${file}: retired sky-* palette left in a §10-migrated file`)

  assert.equal(
    /\bslate-950\b/.test(text),
    false,
    `${file}: slate-950 is the old ink; §10's is #17202A`
  )
}

// --- the contrast floor, enforced where it actually gets broken -------------

// slate-400 is 2.56:1 on white and 2.45:1 on the §10 ground — below AA for the
// metadata it kept being used for (post dates, county headings, the hero's line
// count). It is legible only on the inverted card, so exactly one file may use
// it, and that file must be inverting.
const INK_INVERTED = 'src/components/InfoModuleGrid.tsx'
for (const [file, text] of Object.entries(code)) {
  if (file === INK_INVERTED) continue
  assert.equal(
    /\bslate-400\b/.test(text),
    false,
    `${file}: slate-400 is below WCAG AA on both public grounds — slate-500 is the floor`
  )
}
assert.match(
  code[INK_INVERTED],
  /bg-\[#17202A\]/,
  `${INK_INVERTED} may use slate-400 only because it inverts onto ink`
)

// The contrast gate must actually cover the new palette. Without this, the
// "AA in both themes" claim is a table that never learned about the redesign.
const pairNames = PAIRS.flatMap((pair) => [pair.fg[0], pair.bg[0]])
for (const token of ['ink', 'ground', 'accent', 'slate-500']) {
  assert.equal(
    pairNames.some((name) => name === token || name.startsWith(`${token} (`)),
    true,
    `scripts/contrast-check.mjs does not check the §10 "${token}" colour`
  )
}

// --- §10 tokens are present where the redesign claims them ------------------

// Ink and accent, in the components that carry text and links.
for (const file of [
  'src/components/SiteHero.tsx',
  'src/components/CorridorStatusStrip.tsx',
  'src/components/SpotDirectorySection.tsx',
  'src/components/InfoModuleGrid.tsx',
  'src/app/spots/page.tsx',
  'src/app/slug_pickup/page.tsx',
  'src/app/lostfound/page.tsx',
  'src/app/slugging-rules/page.tsx',
  'src/app/how-it-works/page.tsx',
  'src/components/SpotSearch.tsx',
  'src/components/SpotDetailLayout.tsx',
  'src/components/SpotQuickFacts.tsx',
  'src/components/SpotLiveCounts.tsx',
  'src/components/CommunityLinksCard.tsx',
  'src/components/LegacyContentPage.tsx',
  'src/components/PostIndexPage.tsx',
]) {
  assert.match(source[file], /#17202A/, `${file}: missing the §10 ink`)
  assert.match(source[file], /#2E7D46|#1F5C33|#245F37/i, `${file}: missing the §10 highway-green accent`)
}

// --- honesty: the hero cannot invent a count (§10) --------------------------

const hero = code['src/components/SiteHero.tsx']
const page = code['src/app/page.tsx']

// The hero states plainly that counts are off, in the same words the strip uses.
assert.match(hero, /not switched on yet/, 'the hero must name the unavailable state, not hide it')

// It reports corridor totals from the SAME `corridorStatus()` call the strip
// below it renders, rather than recomputing them from the directory. Two
// independent derivations of "how many active lines" is how the top of the page
// ends up disagreeing with the middle of it.
assert.equal(
  /SPOT_LOCATIONS|SPOT_CORRIDORS/.test(hero),
  false,
  'the hero must not re-derive corridor counts; it takes the page-computed statuses'
)
assert.match(hero, /statuses:\s*CorridorStatus\[\]/, 'the hero takes the computed statuses as a prop')
assert.match(page, /const statuses = corridorStatus\(snapshot\)/, 'computed once on the page')
assert.match(page, /<SiteHero statuses=\{statuses\}/, 'and handed to the hero')
assert.match(page, /<CorridorStatusStrip statuses=\{statuses\}/, 'and to the strip')

// The morning peak window is a claim about the world, so it is stated once and
// the same everywhere. The hero previously said "5:30–8:30 AM inbound" beside a
// strip that said 5:30–9:30, plus an afternoon window with no source in the
// repo at all.
const PEAK = /morning peak is (<span[^>]*>)?5:30–9:30/i
for (const file of [
  'src/components/SiteHero.tsx',
  'src/components/CorridorStatusStrip.tsx',
  'src/components/FastBoard.tsx',
]) {
  assert.match(
    stripComments(read(file)),
    PEAK,
    `${file}: the morning peak window must be the shared 5:30–9:30`
  )
}
assert.equal(
  /3:30|6:30 PM|8:30 AM/.test(hero),
  false,
  'the hero must not state a commute window the repo has no source for'
)

// --- tap targets (§10: >= 44px) ---------------------------------------------

// The two external-link affordances in the directory are icon-only, which makes
// them the smallest touch targets on the public surface.
const directory = code['src/components/SpotDirectorySection.tsx']
assert.equal(
  (directory.match(/h-11 w-11/g) || []).length,
  2,
  'both the community and maps links are 44px square'
)

// Every navbar item — desktop pill, dropdown entry, mobile sheet row, hamburger.
const navbar = code['src/components/Navbar.tsx']
assert.match(navbar, /min-h-\[44px\]/, 'nav items are 44px tall')
assert.match(navbar, /h-11 w-11/, 'the mobile menu toggle is 44px square')
assert.equal(/\bpy-2\.5\b/.test(navbar), false, 'py-2.5 pills are 40px — under the §10 target')

// The hero CTAs and the footer search, which are the only other public controls.
assert.equal((hero.match(/min-h-\[44px\]/g) || []).length, 2, 'both hero CTAs are 44px tall')
assert.equal(
  (code['src/app/layout.tsx'].match(/min-h-\[44px\]/g) || []).length,
  2,
  'the footer search field and button are both 44px tall'
)

// --- copy that depends on data must be guarded ------------------------------

// InfoModuleGrid's heading says "Four things worth knowing" and its layout
// gives the first module a 3-row feature cell beside three single-row cells.
// Both are true of four modules and of no other number.
assert.equal(RESOURCE_MODULES.length, 4, 'InfoModuleGrid\'s heading and grid both assume four modules')
assert.match(code['src/components/InfoModuleGrid.tsx'], /Four things worth knowing/)

// --- the archive list does not print the same title three times -------------

// `summarizeLegacyPost` returns the head of `bodyText`, and every migrated
// WordPress page's `bodyText` opens with its own H1, the "Home" breadcrumb, and
// the H1 again. Rendering it beside the title is the title, twice, next to the
// title. Proven from the data rather than asserted from memory, so this starts
// passing on its own the day the scrape stops including the breadcrumb chrome.
const { getRecentLegacyPosts, summarizeLegacyPost } = await import('../src/lib/legacy-posts.ts')
const sample = getRecentLegacyPosts(3)
assert.equal(sample.length, 3, 'the homepage shows three archive entries')
for (const post of sample) {
  const bareTitle = post.title.replace(/\s*\|\s*Sluglines$/, '')
  assert.equal(
    summarizeLegacyPost(post, 140).startsWith(bareTitle),
    true,
    `${post.path}: summary still leads with the title — re-check whether the summary column can return`
  )
}
assert.equal(
  /summarizeLegacyPost/.test(code['src/components/RecentPostsSection.tsx']),
  false,
  'the archive list shows title and date only while the summary is duplicated title text'
)

// --- the shared component classes moved with the page that uses them --------

// `.btn-primary`, `.btn-secondary` and `.section-label` live in globals.css and
// are used by exactly one page, `/how-it-works`. That is what made them safe to
// migrate in a slice scoped out of the authenticated surface, and it is the fact
// most likely to stop being true — the day a login screen reaches for
// `.btn-primary`, this assertion is the one that notices.
const globals = stripComments(read('src/app/globals.css'))
const SHARED_CLASSES = ['btn-primary', 'btn-secondary', 'section-label']

const classUsers = REDESIGNED.concat([
  'src/app/login/page.tsx',
  'src/app/verify/page.tsx',
  'src/app/onboarding/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/components/LoginForm.tsx',
  'src/components/VerifyForm.tsx',
  'src/components/OnboardingForm.tsx',
  'src/components/CheckInStatusPanel.tsx',
]).filter((file) => fs.existsSync(path.join(root, file)))

for (const file of classUsers) {
  for (const className of SHARED_CLASSES) {
    const used = new RegExp(`\\b${className}\\b`).test(stripComments(read(file)))
    if (!used) continue
    assert.equal(
      file,
      'src/app/how-it-works/page.tsx',
      `${file} uses .${className}, which is painted for the light §10 surface. ` +
        'If an authenticated screen needs it, the class has to be split rather than shared.'
    )
  }
}

// Those three classes carry the §10 accent rather than the retired sky brand or
// the DARK shell's `--accent` (#63b3ed, which is 2.27:1 on the §10 ground).
for (const className of SHARED_CLASSES) {
  const block = new RegExp(`\\.${className}\\s*\\{([\\s\\S]*?)\\}`).exec(globals)
  assert.ok(block, `globals.css must still define .${className}`)
  assert.equal(
    /sky-\d{2,3}|var\(--accent\)/.test(block[1]),
    false,
    `.${className}: still painted from the retired sky brand or the dark shell's --accent`
  )
  assert.match(block[1], /#2E7D46/i, `.${className}: missing the §10 accent`)
}

// The legacy WordPress body renders inside LegacyContentPage, so its link and
// button colours are part of the public surface. #0369a1 is sky-700 in hex —
// the same retired brand, written in a form the utility scan above cannot see.
assert.equal(
  /#0369a1/i.test(globals),
  false,
  'globals.css: #0369a1 is sky-700 — the retired brand surviving as a raw hex in .legacy-content'
)

// --- §10's role tones: `--driver` is blue, and specifically not sky ----------

// Every surface that distinguishes rider from driver states it in the same two
// colours. Sky was the retired brand, so reusing it for the driver role would
// have kept the palette alive under a new name (the reason CorridorStatusStrip
// gives for blue-800). Each of these pairs a tone with a visible text label, so
// the roles never depend on colour — the labels are asserted here too, because
// that is the WCAG 1.4.1 half.
for (const file of [
  'src/components/CorridorStatusStrip.tsx',
  'src/components/SpotLiveCounts.tsx',
]) {
  const text = code[file]
  assert.match(text, /tone === 'rider'/, `${file}: no rider/driver tone split`)
  assert.match(text, /\bamber-\d{2,3}\b/, `${file}: the rider tone must be §10's amber`)
  assert.match(text, /\bblue-\d{2,3}\b/, `${file}: the driver tone must be §10's blue`)
  assert.match(text, /Riders waiting/, `${file}: the rider count must carry its label`)
  assert.match(text, /Driver offers/, `${file}: the driver count must carry its label`)
}

const rules = code['src/app/slugging-rules/page.tsx']
assert.match(rules, /'rider'\s*\?\s*'text-amber-800/, '/slugging-rules: the rider list takes §10 amber')
assert.match(rules, /:\s*'text-blue-800/, '/slugging-rules: the driver list takes §10 blue, not the retired sky')
for (const label of ['For riders', 'For drivers']) {
  assert.match(rules, new RegExp(label), `/slugging-rules: "${label}" is what carries the role, not the tone`)
}

// --- honesty: /how-it-works cannot outrun its sources (§10) ------------------

const howItWorks = stripComments(read('src/app/how-it-works/page.tsx'))

// The canonical peak windows are 05:30–09:30 and 15:00–19:00 ET (rev. 6 §12) —
// the denominator every corridor count is bucketed into. This page stated
// "6 AM to 9 AM" and "4 PM to 7 PM", disagreeing with the four components that
// print the morning window and with the architecture doc for the afternoon one.
assert.match(
  howItWorks,
  /5:30–9:30/,
  '/how-it-works: the morning peak must be the shared 5:30–9:30'
)
assert.match(
  howItWorks,
  /3:00–7:00/,
  '/how-it-works: the afternoon peak must be the canonical 15:00–19:00'
)
for (const wrong of ['6 AM to 9 AM', '4 PM to 7 PM']) {
  assert.equal(
    howItWorks.includes(wrong),
    false,
    `/how-it-works: "${wrong}" contradicts the canonical peak windows`
  )
}

// Nothing in this repo measures a safety record, and this is the page a
// first-time rider reads before getting into a stranger's car.
assert.equal(
  /safety record/i.test(howItWorks),
  false,
  '/how-it-works: a safety record is a measurement, and nothing here measures one'
)

// Live counts are not switched on, and even switched on they are rider and
// driver counts — nothing on this site measures a wait.
assert.equal(
  /wait times?/i.test(howItWorks),
  false,
  '/how-it-works: the site has no wait-time measurement to promise'
)

// The 1975 start date IS sourced — the legacy About Slugging page — so the fix
// kept it rather than deleting the whole answer.
assert.match(howItWorks, /1975/, '/how-it-works: the sourced start date should survive the correction')

// --- /slugging-rules-and-etiquette cannot drift from /slugging-rules --------

// It is a re-export, not a copy, which is why migrating one migrated both. A
// later edit that inlines a second copy of the page would be a second palette
// to keep in step, and this is where that gets noticed.
const etiquette = stripComments(read('src/app/slugging-rules-and-etiquette/page.tsx'))
assert.match(
  etiquette,
  /export\s*\{[^}]*\}\s*from\s*'@\/app\/slugging-rules\/page'/,
  '/slugging-rules-and-etiquette must re-export /slugging-rules rather than copy it'
)

// --- tap targets on the rest of the public surface --------------------------

// The CTAs and links this slice migrated, all of which were under 44px.
for (const file of [
  'src/app/lostfound/page.tsx',
  'src/components/SpotDetailLayout.tsx',
  'src/components/SpotLiveCounts.tsx',
  'src/components/LegacyContentPage.tsx',
]) {
  assert.match(code[file], /min-h-\[44px\]/, `${file}: its controls must meet §10's 44px floor`)
}

// The two shared button classes, which `/how-it-works` renders as its only CTAs.
for (const className of ['btn-primary', 'btn-secondary']) {
  const block = new RegExp(`\\.${className}\\s*\\{([\\s\\S]*?)\\}`).exec(globals)
  assert.match(block[1], /min-h-\[44px\]/, `.${className}: was 40px, under the §10 target`)
}

// --- the mono font the redesign is built on is actually wired ---------------

// `font-mono` appears on every eyebrow, corridor label and numeral in the
// redesign. Until tailwind.config.ts mapped it, those resolved to the system
// monospace stack while layout.tsx loaded and preloaded JetBrains Mono for
// nobody.
const tailwindConfig = read('tailwind.config.ts')
assert.match(tailwindConfig, /mono:\s*\[\s*'var\(--font-mono\)'/, 'font-mono resolves to the loaded face')
assert.match(read('src/app/layout.tsx'), /variable: '--font-mono'/, 'and layout.tsx still defines it')

const monoUsers = REDESIGNED.filter((file) => /\bfont-mono\b/.test(source[file]))
assert.equal(monoUsers.length >= 5, true, 'the redesign leans on font-mono across the surface')

console.log(
  `public surface tokens: ${REDESIGNED.length} migrated files, no sky-* leftovers, ` +
    `${PAIRS.length} contrast pairs, tap targets >= 44px`
)
