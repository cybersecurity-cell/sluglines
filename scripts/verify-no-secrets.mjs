import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const excludedDirectories = new Set(['.git', '.next', '.npm-cache', '.vercel', '.worktrees', 'node_modules', 'playwright-report', 'test-results'])
const excludedFiles = new Set(['.env.local'])
const textExtensions = new Set(['', '.css', '.example', '.html', '.js', '.json', '.md', '.mjs', '.sql', '.toml', '.ts', '.tsx', '.txt', '.yml', '.yaml'])
const rules = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'OpenAI-style secret', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  { name: 'literal Vercel token', pattern: /VERCEL_TOKEN\s*=\s*[A-Za-z0-9_-]{20,}/ },
  { name: 'literal service-role token', pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
]

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await files(fullPath))
    else if (!excludedFiles.has(entry.name) && textExtensions.has(path.extname(entry.name).toLowerCase())) found.push(fullPath)
  }
  return found
}

const findings = []
for (const file of await files(root)) {
  const content = await readFile(file, 'utf8')
  for (const rule of rules) {
    if (rule.pattern.test(content)) findings.push(`${path.relative(root, file)}: ${rule.name}`)
  }
}

assert.deepEqual(findings, [], `Possible committed secrets:\n${findings.join('\n')}`)
console.log('Secret-pattern audit passed.')
