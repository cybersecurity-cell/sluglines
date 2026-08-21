import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeContentHtml,
  stripHtml,
  normalizeHref,
  safeUrl,
  escapePipe,
} from '../scripts/migrate-sluglines-content.mjs'

// The output of normalizeContentHtml is rendered through dangerouslySetInnerHTML
// in LegacyContentPage.tsx, so every case below is a real sink, not a style test.

test('drops script elements and their contents', () => {
  const out = normalizeContentHtml('<p>ok</p><script>alert(1)</script>', '/x/')
  assert.equal(out.includes('alert(1)'), false)
  assert.equal(out.includes('<script'), false)
  assert.equal(out.includes('ok'), true)
})

test('survives the nested-tag bypass that defeats a single-pass stripper', () => {
  // A regex doing .replace(/<script.*?<\/script>/gi,'') removes the inner pair
  // and rejoins the outer halves into a working <script> tag.
  const out = normalizeContentHtml('<scr<script>ipt>alert(1)</scr</script>ipt>', '/x/')
  // What matters is that no element survives, not that the characters are gone:
  // leftover payload text renders as visible prose and cannot execute. Here the
  // result is "ipt&gt;alert(1)ipt&gt;" — every '<' is destroyed or escaped.
  assert.equal(/<script/i.test(out), false)
  assert.equal(out.includes('<'), false)
})

test('drops event handler attributes without enumerating their names', () => {
  const out = normalizeContentHtml('<p onclick="alert(1)" ONMOUSEOVER=x onfocusin="y">hi</p>', '/x/')
  assert.equal(/on[a-z]+=/i.test(out), false)
  assert.equal(out.includes('hi'), true)
})

test('drops an unquoted event handler', () => {
  // The old rule required quotes: /\s(on\w+)=["'][^"']*["']/
  const out = normalizeContentHtml('<img src="/a.png" onerror=alert(1)>', '/x/')
  assert.equal(/onerror/i.test(out), false)
})

test('rejects javascript: hrefs, including entity-encoded ones', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '&#106;avascript:alert(1)',
    '&#x6a;avascript:alert(1)',
  ]) {
    const out = normalizeContentHtml(`<a href="${href}">x</a>`, '/x/')
    assert.equal(/javascript:/i.test(out), false, `leaked: ${href}`)
  }
})

test('rejects a scheme split by a control character', () => {
  // Browsers strip the tab and navigate; a raw-string denylist does not see it.
  assert.equal(safeUrl('java\tscript:alert(1)'), null)
  assert.equal(safeUrl('java\nscript:alert(1)'), null)
  assert.equal(safeUrl('\u0000javascript:alert(1)'), null)
})

test('rejects data: and vbscript: URLs', () => {
  assert.equal(safeUrl('data:text/html;base64,PHNjcmlwdD4='), null)
  assert.equal(safeUrl('vbscript:msgbox(1)'), null)
})

test('allows ordinary URL shapes', () => {
  assert.equal(safeUrl('/spots/'), '/spots/')
  assert.equal(safeUrl('#anchor'), '#anchor')
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a')
  assert.equal(safeUrl('mailto:a@b.com'), 'mailto:a@b.com')
})

test('drops iframes and form controls', () => {
  const out = normalizeContentHtml(
    '<iframe src="https://evil.test"></iframe><form action="/x"><input name="a"><button>go</button></form>',
    '/x/',
  )
  for (const tag of ['<iframe', '<input', '<button', '<form']) {
    assert.equal(out.includes(tag), false, `leaked ${tag}`)
  }
})

test('unwraps an unknown element but keeps its text', () => {
  const out = normalizeContentHtml('<form><p>keep this sentence</p></form>', '/x/')
  assert.equal(out.includes('keep this sentence'), true)
  assert.equal(out.includes('<form'), false)
})

test('strips style attributes and non-allowed classes', () => {
  const out = normalizeContentHtml('<p style="x:y" class="alignleft evil-class">t</p>', '/x/')
  assert.equal(out.includes('style='), false)
  assert.equal(out.includes('alignleft'), true)
  assert.equal(out.includes('evil-class'), false)
})

test('rewrites legacy absolute URLs to relative, but only for the real host', () => {
  const internal = normalizeContentHtml('<a href="https://sluglines.com/spots/">a</a>', '/x/')
  assert.equal(internal.includes('href="/spots/"'), true)

  // The prefix-match bug: this is a different site.
  const lookalike = normalizeContentHtml('<a href="https://sluglines.com.example.net/p/">a</a>', '/x/')
  assert.equal(lookalike.includes('href="https://sluglines.com.example.net/p/"'), true)
})

test('normalizeHref does not treat a lookalike host as internal', () => {
  assert.equal(normalizeHref('https://sluglines.com/about/'), '/about/')
  assert.equal(normalizeHref('https://sluglines.com.example.net/about/'), 'https://sluglines.com.example.net/about/')
  assert.equal(normalizeHref('javascript:alert(1)'), '')
})

test('adds rel=noopener when a link targets a new window', () => {
  const out = normalizeContentHtml('<a href="https://example.com" target="_blank">x</a>', '/x/')
  assert.equal(out.includes('noopener'), true)
})

test('escapes text so it cannot re-enter as markup', () => {
  const out = normalizeContentHtml('<p>5 &lt; 6 &amp; 7 &gt; 2</p>', '/x/')
  assert.equal(out.includes('&lt;'), true)
  assert.equal(/<(?!\/?p\b)/.test(out), false)
})

test('stripHtml does not leak attribute values containing >', () => {
  // /<[^>]+>/g ends the tag at the first '>', leaving `b">` behind as text.
  assert.equal(stripHtml('<a title="a>b">link</a>'), 'link')
})

test('stripHtml ignores script and style text', () => {
  assert.equal(stripHtml('<p>keep</p><script>drop()</script><style>.x{}</style>'), 'keep')
})

test('img without a usable src is dropped, and lazy loading is added', () => {
  assert.equal(normalizeContentHtml('<img src="javascript:alert(1)">', '/x/').includes('<img'), false)
  assert.equal(normalizeContentHtml('<img src="/a.png">', '/x/').includes('loading="lazy"'), true)
})

test('empty content falls back to a placeholder with the path escaped', () => {
  const out = normalizeContentHtml('<script>x</script>', '/a"b/')
  assert.equal(out.includes('&quot;'), true)
  assert.equal(out.includes('<script'), false)
})

test('escapePipe escapes the backslash before the pipe', () => {
  assert.equal(escapePipe('a\\|b'), 'a\\\\\\|b')
  assert.equal(escapePipe('a|b'), 'a\\|b')
})
