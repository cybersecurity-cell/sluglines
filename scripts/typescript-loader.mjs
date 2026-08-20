import { access, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import ts from 'typescript'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/link' || specifier === 'next/navigation') {
    return nextResolve(`${specifier}.js`, context)
  }

  if (specifier.startsWith('@/')) {
    const candidateBase = path.join(projectRoot, 'src', specifier.slice(2))
    for (const extension of ['.ts', '.tsx']) {
      const candidate = `${candidateBase}${extension}`
      try {
        await access(candidate)
        return { url: pathToFileURL(candidate).href, shortCircuit: true }
      } catch {
        // Try the next supported TypeScript extension.
      }
    }
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parentPath = fileURLToPath(context.parentURL)
    const candidateBase = path.resolve(path.dirname(parentPath), specifier)
    for (const extension of ['.ts', '.tsx']) {
      const candidate = `${candidateBase}${extension}`
      try {
        await access(candidate)
        return { url: pathToFileURL(candidate).href, shortCircuit: true }
      } catch {
        // Try the next supported TypeScript extension.
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {}', shortCircuit: true }
  }

  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    const result = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    })
    return { format: 'module', source: result.outputText, shortCircuit: true }
  }
  return nextLoad(url, context)
}
