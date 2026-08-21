import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { getLegacyStaticParams } from '../src/lib/legacy-content.ts'

const root = process.cwd()

assert.equal(fs.existsSync(path.join(root, 'src/app/slug_pickup/page.tsx')), true)
assert.equal(fs.existsSync(path.join(root, 'src/app/blog/page.tsx')), true)
assert.equal(fs.existsSync(path.join(root, 'src/app/news/page.tsx')), true)

const slugPickupPage = fs.readFileSync(path.join(root, 'src/app/slug_pickup/page.tsx'), 'utf8')
assert.equal(slugPickupPage.includes('SpotSearch'), true)
assert.equal(slugPickupPage.includes('LegacyContentPage'), false)

const blogPage = fs.readFileSync(path.join(root, 'src/app/blog/page.tsx'), 'utf8')
assert.equal(blogPage.includes('PostIndexPage'), true)
assert.equal(blogPage.includes('LegacyContentPage'), false)

const legacyStaticPaths = getLegacyStaticParams().map((params) => params.legacyPath.join('/'))
assert.equal(legacyStaticPaths.includes('slug_pickup'), false)
assert.equal(legacyStaticPaths.includes('blog'), false)
assert.equal(legacyStaticPaths.includes('news'), false)
assert.equal(legacyStaticPaths.includes('slugging-rules-and-etiquette'), false)
