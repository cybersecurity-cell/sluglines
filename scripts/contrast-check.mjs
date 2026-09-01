#!/usr/bin/env node

// WCAG AA contrast gate over both of this app's palettes (issue #20, AC23).
//
// "Both themes" here means the two palettes the app actually ships, not a
// light/dark toggle it does not have:
//
//   1. The DARK shell — the CSS custom properties in src/app/globals.css,
//      used by the layout footer, the dashboard and the app chrome. Parsed
//      from the stylesheet at run time, so changing a token re-checks it.
//   2. The LIGHT public surface — the Tailwind utility colours the public
//      pages pin explicitly (`bg-white text-slate-950` and friends). Tailwind
//      resolves these to fixed hex values; they are declared here as data with
//      their utility names so a palette bump is a visible diff.
//
// Every pair below is a combination the UI actually renders. The gate is AA:
// 4.5:1 for normal text, 3:1 for large text (>= 24px, or >= 18.66px bold) and
// for non-text UI. A pair claiming the lower bar must say why.
//
// Node built-ins only, like every other script in scripts/.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// -----------------------------------------------------------------------------
// WCAG 2.x relative luminance and contrast ratio
// -----------------------------------------------------------------------------
function srgbChannel(value) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`)
  const n = parseInt(m[1], 16)
  return (
    0.2126 * srgbChannel((n >> 16) & 0xff) +
    0.7152 * srgbChannel((n >> 8) & 0xff) +
    0.0722 * srgbChannel(n & 0xff)
  )
}

export function contrastRatio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

// -----------------------------------------------------------------------------
// Palette 1: the dark shell, read from the stylesheet rather than restated
// -----------------------------------------------------------------------------
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8')
const rootBlock = /:root\s*\{([\s\S]*?)\}/.exec(css)
if (!rootBlock) throw new Error('globals.css must declare its tokens on :root')

const tokens = {}
for (const m of rootBlock[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens[m[1]] = m[2]
}

const required = ['bg', 'surface', 'surface-2', 'text', 'muted', 'accent', 'accent-2', 'green', 'red']
for (const name of required) {
  if (!tokens[name]) throw new Error(`globals.css :root is missing --${name} (or it is not 6-digit hex)`)
}

// -----------------------------------------------------------------------------
// Palette 2: the light public surface — Tailwind v3 default values, pinned by name
// -----------------------------------------------------------------------------
const tw = {
  white: '#ffffff',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-950': '#020617',
  'sky-600': '#0284c7',
  'sky-700': '#0369a1',
  'sky-800': '#075985',
}

// -----------------------------------------------------------------------------
// Palette 3: the §10 public design system — the redesigned marketing surface
// -----------------------------------------------------------------------------
// §10 names three colours (near-white ground, ink, highway-green accent) and two
// semantic role tones (`--rider` amber, `--driver` blue). They are pinned here
// by the same rule as palette 2: the public components write them as Tailwind
// arbitrary values, Tailwind resolves them to fixed hex, so a palette change is
// a visible diff in this table and a re-run of the gate.
//
// `slate-400` is deliberately ABSENT. The redesign reached for it four times as
// a quiet metadata grey — post dates, county labels, the hero's line count — and
// it is 2.56:1 on white. Anything that quiet on this surface is slate-500
// (4.76:1 on white, 4.55:1 on the ground), which is the floor.
const ui = {
  ground: '#FAFAF8',
  ink: '#17202A',
  accent: '#2E7D46',
  'accent-hover': '#245F37',
  'accent-link-hover': '#1F5C33',
  'accent-tint': '#EAF2ED',
  'accent-on-ink': '#7BC994',
  'stone-100': '#f5f5f4',
  'amber-800': '#92400e',
  'blue-800': '#1e40af',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
}

// -----------------------------------------------------------------------------
// The pairs the UI renders. `large: true` claims the 3:1 bar and must say why.
// -----------------------------------------------------------------------------
export const PAIRS = [
  // Dark shell
  { theme: 'dark', fg: ['--text', tokens.text], bg: ['--bg', tokens.bg] },
  { theme: 'dark', fg: ['--text', tokens.text], bg: ['--surface', tokens.surface] },
  { theme: 'dark', fg: ['--text', tokens.text], bg: ['--surface-2', tokens['surface-2']] },
  { theme: 'dark', fg: ['--muted', tokens.muted], bg: ['--bg', tokens.bg] },
  { theme: 'dark', fg: ['--muted', tokens.muted], bg: ['--surface', tokens.surface] },
  { theme: 'dark', fg: ['--muted', tokens.muted], bg: ['--surface-2', tokens['surface-2']] },
  { theme: 'dark', fg: ['--accent', tokens.accent], bg: ['--bg', tokens.bg] },
  { theme: 'dark', fg: ['--accent', tokens.accent], bg: ['--surface', tokens.surface] },
  { theme: 'dark', fg: ['--accent-2', tokens['accent-2']], bg: ['--bg', tokens.bg] },
  { theme: 'dark', fg: ['--green', tokens.green], bg: ['--surface', tokens.surface] },
  { theme: 'dark', fg: ['--red', tokens.red], bg: ['--surface', tokens.surface] },

  // Light public surface
  { theme: 'light', fg: ['slate-950', tw['slate-950']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['slate-700', tw['slate-700']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['slate-600', tw['slate-600']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['slate-700', tw['slate-700']], bg: ['slate-50', tw['slate-50']] },
  { theme: 'light', fg: ['slate-600', tw['slate-600']], bg: ['slate-50', tw['slate-50']] },
  { theme: 'light', fg: ['slate-600', tw['slate-600']], bg: ['slate-100', tw['slate-100']] },
  { theme: 'light', fg: ['slate-700', tw['slate-700']], bg: ['slate-100', tw['slate-100']] },
  { theme: 'light', fg: ['white', tw.white], bg: ['sky-700', tw['sky-700']] },
  // The footer search button. It was `bg-sky-600`, which is 3.90:1 against white
  // and failed Lighthouse's `color-contrast` audit on the first run of this gate
  // — a pair this table did not cover, which is exactly why the Lighthouse job
  // and this script are both worth having: a hand-written pair list can only
  // check the combinations someone thought of.
  //
  // It is now the §10 accent, not sky-700: the redesign retired the sky brand
  // and a button in the retired colour is exactly the leftover that survives a
  // palette migration.
  { theme: 'dark', fg: ['white', tw.white], bg: ['accent (footer button)', ui.accent] },
  { theme: 'dark', fg: ['white', tw.white], bg: ['accent-hover (footer button)', ui['accent-hover']] },
  { theme: 'light', fg: ['sky-800', tw['sky-800']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['slate-800', tw['slate-800']], bg: ['white', tw.white] },

  // §10 public design system — ground, ink, accent
  { theme: 'light', fg: ['ink', ui.ink], bg: ['white', tw.white] },
  { theme: 'light', fg: ['ink', ui.ink], bg: ['ground', ui.ground] },
  { theme: 'light', fg: ['slate-700', tw['slate-700']], bg: ['ground', ui.ground] },
  { theme: 'light', fg: ['slate-600', tw['slate-600']], bg: ['ground', ui.ground] },
  // The quiet-metadata floor, on both grounds the public surface uses. This is
  // the pair that fails the moment anyone reaches for slate-400 again.
  { theme: 'light', fg: ['slate-500', tw['slate-500']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['slate-500', tw['slate-500']], bg: ['ground', ui.ground] },
  // Accent as link text and as a button ground, in both directions.
  { theme: 'light', fg: ['accent', ui.accent], bg: ['white', tw.white] },
  { theme: 'light', fg: ['accent', ui.accent], bg: ['ground', ui.ground] },
  { theme: 'light', fg: ['white', tw.white], bg: ['accent', ui.accent] },
  { theme: 'light', fg: ['accent-link-hover', ui['accent-link-hover']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['accent-link-hover', ui['accent-link-hover']], bg: ['ground', ui.ground] },
  // The navbar's active pill: green label on a green tint.
  { theme: 'light', fg: ['accent-link-hover', ui['accent-link-hover']], bg: ['accent-tint', ui['accent-tint']] },
  // Idle nav labels over the hover ground.
  { theme: 'light', fg: ['slate-600', tw['slate-600']], bg: ['stone-100', ui['stone-100']] },
  // §10's semantic role tones on the corridor strip. Both are read alongside a
  // text label, so this checks legibility, not meaning.
  { theme: 'light', fg: ['amber-800 (--rider)', ui['amber-800']], bg: ['white', tw.white] },
  { theme: 'light', fg: ['blue-800 (--driver)', ui['blue-800']], bg: ['white', tw.white] },
  // The InfoModuleGrid featured card inverts to ink. slate-400 is legible here
  // (6.42:1) and only here — which is why it is pinned against ink and nothing
  // else in this table.
  { theme: 'light', fg: ['white', tw.white], bg: ['ink (featured card)', ui.ink] },
  { theme: 'light', fg: ['slate-300', ui['slate-300']], bg: ['ink (featured card)', ui.ink] },
  { theme: 'light', fg: ['slate-400', ui['slate-400']], bg: ['ink (featured card)', ui.ink] },
  { theme: 'light', fg: ['accent-on-ink', ui['accent-on-ink']], bg: ['ink (featured card)', ui.ink] },
]

export function checkContrast() {
  const failures = []
  const report = []

  for (const pair of PAIRS) {
    const ratio = contrastRatio(pair.fg[1], pair.bg[1])
    const bar = pair.large ? 3 : 4.5
    const ok = ratio >= bar
    report.push(
      `${ok ? 'ok  ' : 'FAIL'} [${pair.theme}] ${pair.fg[0]} on ${pair.bg[0]}: ` +
        `${ratio.toFixed(2)}:1 (needs ${bar}:1${pair.large ? `, large: ${pair.why}` : ''})`
    )
    if (!ok) failures.push(pair)
  }

  return { failures, report }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { failures, report } = checkContrast()
  console.log(report.join('\n'))
  console.log(`\ncontrast: ${PAIRS.length - failures.length}/${PAIRS.length} pairs meet WCAG AA`)
  if (failures.length > 0) process.exit(1)
}
