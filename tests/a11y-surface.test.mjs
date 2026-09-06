// Issue #141 — the accessibility findings that contrast tokens and axe did
// not catch, pinned in source so they cannot quietly come back: keyboard
// reach of the About menu, form-control contrast, target sizes, landmarks, a
// skip link, reduced motion, and label sizes. What this file does NOT claim:
// that the rendered tree is accessible — `tests/e2e/accessibility.spec.ts`
// runs axe over it, and `scripts/contrast-check.mjs` runs the ratios.

import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { PAIRS, contrastRatio } from '../scripts/contrast-check.mjs'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// --- the About menu is reachable without a mouse -----------------------------
const navbar = read('src/components/Navbar.tsx')
assert.match(navbar, /onClick=\{\(\) => setAboutOpen\(\(open\) => !open\)\}/, 'About toggles on click (and therefore Enter/Space on a button)')
assert.match(navbar, /event\.key === 'ArrowDown'/, 'ArrowDown opens the About menu')
assert.match(navbar, /event\.key === 'Escape'/, 'Escape closes the About menu and the mobile sheet')
assert.match(navbar, /aria-haspopup="menu"/)
assert.match(navbar, /aria-controls="about-menu"/)
assert.match(navbar, /id="about-menu"\s+role="menu"/, 'the popup is a menu with the id the button controls')
assert.match(navbar, /role="menuitem"/)
assert.match(navbar, /onBlur=\{\(event\) => \{\s*if \(!aboutRef\.current\?\.contains\(event\.relatedTarget/, 'focus leaving the menu closes it')

// --- landmarks and the skip link ------------------------------------------------
const layout = read('src/app/layout.tsx')
assert.match(layout, /<header>\s*<Navbar \/>\s*<\/header>/, 'the nav sits in a header landmark')
assert.match(layout, /<main id="main"/, 'the main landmark is the skip target')
assert.match(layout, /href="#main"[\s\S]{0,400}Skip to content/, 'a skip link precedes the nav')
assert.match(layout, /sr-only focus:not-sr-only/, 'the skip link is visible on focus and hidden otherwise')
assert.ok(layout.indexOf('href="#main"') < layout.indexOf('<Navbar'), 'the skip link comes before the nav in DOM order')
assert.match(layout, /href="\/about-slugging"/, 'About Slugging is reachable from the footer')
assert.match(layout, /href="\/about-us"/, 'About Us is reachable from the footer')
assert.equal((layout.match(/className="inline-block py-1\.5 hover:text-white/g) ?? []).length >= 12, true, 'footer links have a tap height, not an 18px line')

const spotLayout = read('src/components/SpotDetailLayout.tsx')
assert.equal(/<main\b/.test(stripComments(spotLayout)), false, 'the spot page renders no nested <main>; the root layout owns the landmark')

// --- reduced motion -------------------------------------------------------------
const css = read('src/app/globals.css')
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?html \{ scroll-behavior: auto; \}[\s\S]*?\.animate-fade-up \{ animation: none;[\s\S]*?\.live-dot \{ animation: none; \}/, 'every decorative motion is off under prefers-reduced-motion')

// --- form-control contrast: the borders and rings named in #141 ------------------
for (const file of [
  'src/components/LoginForm.tsx',
  'src/components/VerifyForm.tsx',
  'src/components/OnboardingForm.tsx',
  'src/components/PostSeatForm.tsx',
  'src/components/SpotSearch.tsx',
]) {
  const source = stripComments(read(file))
  assert.equal(/border-(slate|stone)-300 (px|bg)/.test(source), false, `${file}: no ~1.5:1 control border`)
  assert.equal(/focus:ring-sky-200|focus:ring-\[#EAF2ED\]/.test(source), false, `${file}: no ~1.3:1 focus ring`)
  assert.match(source, /focus:ring-(sky-600|\[#2E7D46\])/, `${file}: a focus ring that clears 3:1 on white`)
  assert.match(source, /border border-(slate|stone)-500/, `${file}: a control border that clears 3:1 on white`)
}
// ...and the pairs are pinned in the contrast gate, at the ratios they must hold.
for (const name of ['slate-500 (input border)', 'stone-500 (input border)', 'sky-600 (focus ring)', 'accent (focus ring)']) {
  const pair = PAIRS.find((p) => p.fg[0] === name && p.bg[0] === 'white')
  assert.ok(pair, `${name} on white must be pinned in scripts/contrast-check.mjs`)
  assert.ok(contrastRatio(pair.fg[1], pair.bg[1]) >= 3, `${name} on white must clear WCAG 1.4.11's 3:1`)
}

// --- target sizes ---------------------------------------------------------------
const directory = read('src/components/SpotDirectorySection.tsx')
assert.match(directory, /flex min-h-\[28px\] items-center truncate text-sm font-semibold/, 'directory rows are at least 24px tall (WCAG 2.5.8), not 20px')
const reserve = read('src/components/ReserveSeatButton.tsx')
assert.match(reserve, /inline-flex min-h-\[44px\] items-center whitespace-nowrap rounded-lg bg-sky-700/, 'the Reserve button is 44px, not 32px')

// --- label sizes ----------------------------------------------------------------
assert.equal(/text-\[11px\]/.test(read('src/components/SiteHero.tsx')), false, 'no 11px mono labels on the hero; the floor is 12px')

console.log('a11y-surface: ok')
