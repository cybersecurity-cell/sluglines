import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const ci = await readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
const deploy = await readFile(path.join(root, '.github', 'workflows', 'deploy.yml'), 'utf8')
const workflows = `${ci}\n${deploy}`

assert.match(packageJson.devDependencies?.vercel ?? '', /^\d+\.\d+\.\d+$/)
const actionRefs = [...workflows.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1])
assert.ok(actionRefs.length > 0)
for (const actionRef of actionRefs) {
  if (actionRef === 'supabase/setup-cli@v1') continue
  assert.match(actionRef, /@[0-9a-f]{40}$/)
}
assert.doesNotMatch(workflows, /version:\s*latest/)
assert.match(ci, /supabase\/setup-cli@v1[\s\S]*version:\s*\d+\.\d+\.\d+/)
assert.doesNotMatch(deploy, /\bnpx\s+vercel\b/)
assert.match(deploy, /\.\/node_modules\/\.bin\/vercel\s+pull/)
assert.match(deploy, /\.\/node_modules\/\.bin\/vercel\s+build/)
assert.match(deploy, /\.\/node_modules\/\.bin\/vercel\s+deploy/)
assert.match(deploy, /\.\/node_modules\/\.bin\/vercel\s+alias\s+set[\s\S]*staging\.sluglines\.com/)

console.log('CI tooling is version-pinned and deployment install fallback is disabled.')
