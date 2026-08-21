import { strict as assert } from 'node:assert'
import {
  getLegacyPostHref,
  getRecentLegacyPosts,
  getRelatedLegacyPosts,
  summarizeLegacyPost,
} from '../src/lib/legacy-posts.ts'

const recentPosts = getRecentLegacyPosts()

assert.equal(recentPosts.length >= 12, true)
assert.equal(recentPosts.every((post) => post.kind === 'post'), true)
assert.equal(recentPosts.some((post) => post.path === '/blog/'), false)

const firstPost = recentPosts[0]
assert.equal(getLegacyPostHref(firstPost).startsWith('/'), true)
assert.equal(getLegacyPostHref(firstPost).endsWith('/'), true)

const summary = summarizeLegacyPost({
  ...firstPost,
  bodyText: '  One sentence about slugging.  Another sentence follows.  ',
})
assert.equal(summary, 'One sentence about slugging. Another sentence follows.')

const newsPosts = getRelatedLegacyPosts('news')
assert.equal(newsPosts.length >= 6, true)
assert.equal(newsPosts.every((post) => post.kind === 'post'), true)
