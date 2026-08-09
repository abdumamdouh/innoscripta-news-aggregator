import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SOURCES } from './src/core/sources/registry'

/**
 * The README is the submission: a reviewer scores from it, so every claim in it has to be one
 * they can open or run. Nothing here re-reads prose — it checks the parts that go stale on their
 * own the moment code moves: cited file paths, the script table, the source table, the port the
 * quick start promises, the test-file counts. The script table was already stale once.
 *
 * Same shape as docker.test.ts: cross-file contracts no single file can enforce alone.
 */
const url = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const read = (relative: string) => readFileSync(url(relative), 'utf8')

const readme = read('./README.md')
const scripts = JSON.parse(read('./package.json')).scripts as Record<string, string>

/** Backticked tokens that name a repo file: `src/…​.ts`, `docker-compose.yml`, `Dockerfile`. */
const citedPaths = [
  ...new Set(
    [...readme.matchAll(/`(Dockerfile|[\w./-]+\.(?:ts|tsx|json|yml|sh|template|css|md))`/g)].map(
      (match) => match[1]!,
    ),
  ),
]

/** `npm test` and `npm run <name>`, as the README spells them. */
const citedScripts = [
  ...new Set([...readme.matchAll(/`npm (?:run )?([\w:]+)`/g)].map((match) => match[1]!)),
].filter((name) => name !== 'install')

const SKIP = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report'])

const countFiles = (dir: string, pattern: RegExp): number => {
  let total = 0
  for (const entry of readdirSync(url(dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue
    if (entry.isDirectory()) total += countFiles(`${dir}/${entry.name}/`, pattern)
    else if (pattern.test(entry.name)) total += 1
  }
  return total
}

/** The `| … | <n> | …` file-count cell of a row in the Testing table. */
const fileCount = (label: string) =>
  Number(readme.match(new RegExp(`\\|[^|\\n]*${label}[^|\\n]*\\|\\s*(\\d+)\\s*\\|`))?.[1])

describe('README', () => {
  it('is the only setup document — no SETUP.md splitting the reviewer in two', () => {
    expect(existsSync(url('./SETUP.md'))).toBe(false)
  })

  it('cites a plausible number of files at all', () => {
    expect(citedPaths.length).toBeGreaterThan(10)
  })

  it.each(citedPaths)('cites %s, which exists', (path) => {
    expect(existsSync(url(`./${path}`))).toBe(true)
  })

  it.each(citedScripts)('promises `npm … %s`, which package.json defines', (name) => {
    expect(Object.keys(scripts)).toContain(name)
  })

  it('documents every script package.json exposes', () => {
    expect(Object.keys(scripts).filter((name) => !citedScripts.includes(name))).toEqual([])
  })

  it('names every registered source, available or not', () => {
    for (const source of SOURCES) expect(readme).toContain(source.label)
  })

  it('promises the port compose actually publishes', () => {
    const port = read('./docker-compose.yml').match(/'\$\{WEB_PORT:-(\d+)\}:\d+'/)?.[1]
    expect(port).toBeDefined()
    expect(readme).toContain(`http://localhost:${port}`)
  })

  it('quotes the real number of test files', () => {
    // Everything vitest picks up, including e2e/providerMocks.test.ts and the root-level suites.
    expect(fileCount('Vitest')).toBe(countFiles('.', /\.test\.tsx?$/))
    expect(fileCount('Playwright')).toBe(countFiles('./e2e/', /\.spec\.ts$/))
  })
})
