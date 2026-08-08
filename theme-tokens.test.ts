import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Tailwind v4 has no config file: `@theme` in src/styles/theme.css is the only token
// source, and a utility whose token is missing is silently dropped — no build error, just
// an unstyled element. This test is the missing build error. It lives at the root next to
// vite.proxy.test.ts because it reads the filesystem, which the src/ tsconfig has no types
// for.
const srcDir = resolve(process.cwd(), 'src')
const themeCss = readFileSync(`${srcDir}/styles/theme.css`, 'utf8')

export function definedColorTokens(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/--color-([\w-]+)\s*:/g), (m) => m[1]!))
}

/** Colour utilities in our own palettes, e.g. `dark:border-danger-300` -> `danger-300`. */
export function referencedColorTokens(source: string): Set<string> {
  const pattern =
    /(?:text|bg|border|ring|outline|divide|fill|stroke|placeholder|caret|decoration|from|via|to)-((?:ink|paper|accent|danger|source)-[a-z0-9]+)/g
  return new Set(Array.from(source.matchAll(pattern), (m) => m[1]!))
}

describe('definedColorTokens', () => {
  it('collects every --color-* name declared in the theme block', () => {
    const tokens = definedColorTokens('@theme { --color-a-1: #fff; --color-b-2 : #000; }')
    expect(tokens).toEqual(new Set(['a-1', 'b-2']))
  })

  it('ignores non-colour custom properties and var() reads', () => {
    const tokens = definedColorTokens(
      '--shadow-soft: 0 1px var(--color-ink-900); --spacing-4: 1px;',
    )
    expect(tokens.has('ink-900')).toBe(false)
    expect(tokens.size).toBe(0)
  })
})

describe('referencedColorTokens', () => {
  it('picks up variant-prefixed utilities', () => {
    expect(referencedColorTokens('dark:border-danger-300 hover:text-accent-600')).toEqual(
      new Set(['danger-300', 'accent-600']),
    )
  })

  it('ignores palettes we do not own and non-colour utilities', () => {
    expect(referencedColorTokens('text-red-500 bg-white min-h-11 gap-1 rounded-lg')).toEqual(
      new Set(),
    )
  })

  it('keeps word-named steps like the per-source badge colours', () => {
    expect(referencedColorTokens('bg-source-guardian')).toEqual(new Set(['source-guardian']))
  })
})

describe('theme.css', () => {
  it('defines danger-300 for the dark-mode error state', () => {
    expect(themeCss).toMatch(/--color-danger-300:\s*#[0-9a-f]{6}/i)
  })

  it('defines every palette token the components reference', () => {
    const defined = definedColorTokens(themeCss)
    const files: string[] = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })

    const missing = files
      .filter((file: string) => /\.tsx?$/.test(file))
      .flatMap((file: string) =>
        Array.from(
          referencedColorTokens(readFileSync(`${srcDir}/${file}`, 'utf8')),
          (token) => [file, token] as const,
        ).filter(([, token]) => !defined.has(token)),
      )

    expect(missing).toEqual([])
  })
})
