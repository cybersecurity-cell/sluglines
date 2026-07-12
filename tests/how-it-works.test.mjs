import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync('src/app/how-it-works/page.tsx', 'utf8')

assert.ok(pageSource.includes('How Slugging Works'))
assert.equal(pageSource.includes('HowSlugging Works'), false)
assert.equal(pageSource.includes('Ã'), false)
assert.equal(pageSource.includes('Â'), false)

for (const imageUrl of [
  'https://sluglines.com/wp-content/uploads/2014/03/img1-600x400-600x400.jpg',
  'https://sluglines.com/wp-content/uploads/2013/10/img2-433x400-433x400.jpg',
  'https://sluglines.com/wp-content/uploads/2013/10/img3-600x400-600x400.jpg',
]) {
  assert.ok(pageSource.includes(imageUrl), `Missing visual asset ${imageUrl}`)
}

for (const caption of [
  'Riders line up at known pickup spots.',
  'Drivers call out or display their destination.',
  'Riders heading that way get in and everyone saves time.',
]) {
  assert.ok(pageSource.includes(caption), `Missing visual caption ${caption}`)
}
