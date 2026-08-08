import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROXY_ROUTES, createProxy, withKey } from './vite.proxy.ts'

const repoFile = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const read = (relative: string) => readFileSync(repoFile(relative), 'utf8')

const ENV = {
  NEWSAPI_KEY: 'newsapi-secret',
  GUARDIAN_KEY: 'guardian-secret',
  NYT_KEY: 'nyt-secret',
}

/** The rewrite Vite would apply for `prefix`, given `env`. */
function rewrite(prefix: string, path: string, env: Record<string, string | undefined> = ENV) {
  const entry = createProxy(env)[prefix] as { rewrite: (path: string) => string }
  return entry.rewrite(path)
}

describe('withKey', () => {
  it('opens the query string when the path has none', () => {
    expect(withKey('/search', 'api-key', 'abc')).toBe('/search?api-key=abc')
  })

  it('appends to an existing query string rather than starting a second one', () => {
    expect(withKey('/search?q=news&page=2', 'api-key', 'abc')).toBe(
      '/search?q=news&page=2&api-key=abc',
    )
  })

  it('leaves the path untouched when the key is missing, rather than sending "undefined"', () => {
    expect(withKey('/search?q=news', 'api-key', undefined)).toBe('/search?q=news')
    expect(withKey('/search?q=news', 'api-key', '')).toBe('/search?q=news')
  })

  it('leaves the path untouched for a source that takes no key', () => {
    expect(withKey('/news/rss.xml', undefined, 'stray-key')).toBe('/news/rss.xml')
  })

  it('percent-encodes a key containing url-significant characters', () => {
    expect(withKey('/search', 'api-key', 'a+b&c=d')).toBe('/search?api-key=a%2Bb%26c%3Dd')
  })
})

describe('createProxy', () => {
  it('strips the /api/<source> prefix and appends each provider its own parameter', () => {
    expect(rewrite('/api/newsapi', '/api/newsapi/everything?q=news')).toBe(
      '/everything?q=news&apiKey=newsapi-secret',
    )
    expect(rewrite('/api/guardian', '/api/guardian/search?q=news')).toBe(
      '/search?q=news&api-key=guardian-secret',
    )
    expect(rewrite('/api/nyt', '/api/nyt/articlesearch.json?q=news')).toBe(
      '/articlesearch.json?q=news&api-key=nyt-secret',
    )
  })

  it('never attaches a key to BBC, even with every key in the environment', () => {
    expect(rewrite('/api/bbc', '/api/bbc/news/technology/rss.xml')).toBe('/news/technology/rss.xml')
  })

  it('serves a bare path when the key is not configured, so the 401 is unambiguous', () => {
    expect(rewrite('/api/guardian', '/api/guardian/search?q=news', {})).toBe('/search?q=news')
  })

  it('rewrites only the leading prefix when it also occurs inside the path', () => {
    expect(rewrite('/api/bbc', '/api/bbc/news/api/bbc/rss.xml')).toBe('/news/api/bbc/rss.xml')
  })

  it('points every route at its documented upstream with changeOrigin on', () => {
    for (const [prefix, route] of Object.entries(PROXY_ROUTES)) {
      const entry = createProxy(ENV)[prefix] as { target: string; changeOrigin: boolean }
      expect(entry.target).toBe(route.target)
      expect(entry.changeOrigin).toBe(true)
    }
  })
})

/**
 * The item's whole promise is that dev and container behave identically. Nothing in the
 * language stops the two configs drifting, so the drift is what gets asserted.
 */
describe('nginx template parity with the dev proxy', () => {
  const template = read('./docker/nginx.conf.template')
  const envExample = read('./.env.example')

  it.each(Object.entries(PROXY_ROUTES))('has a location for %s', (prefix, route) => {
    expect(template).toContain(`location ~ ^${prefix}/(?<upstream_path>.*)$`)
    expect(template).toContain(`proxy_pass ${route.target}/$upstream_path`)
  })

  it.each(Object.entries(PROXY_ROUTES).filter(([, route]) => route.env))(
    'injects %s’s key with the same parameter name the dev proxy uses',
    (_prefix, route) => {
      expect(template).toContain(`set $upstream_args "${route.param}=\${${route.env}}&$args"`)
    },
  )

  it('declares every key it consumes in .env.example, unprefixed so Vite cannot inline it', () => {
    const used = [...template.matchAll(/\$\{(\w+)\}/g)].map((match) => match[1])
    expect(used.length).toBeGreaterThan(0)
    for (const name of used) {
      expect(name).not.toMatch(/^VITE_/)
      expect(envExample).toMatch(new RegExp(`^${name}=`, 'm'))
    }
  })

  it('names no key for the source that has none', () => {
    const bbc = template.slice(template.indexOf('location ~ ^/api/bbc/'))
    expect(bbc.slice(0, bbc.indexOf('}'))).not.toContain('${')
  })
})

const hasEnvsubst = (() => {
  try {
    execFileSync('sh', ['-c', 'command -v envsubst'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!hasEnvsubst)('entrypoint rendering', () => {
  function render(env: Record<string, string>) {
    const output = join(mkdtempSync(join(tmpdir(), 'nginx-render-')), 'default.conf')
    execFileSync('sh', [repoFile('./docker/entrypoint.sh'), 'render-only'], {
      env: {
        ...env,
        PATH: process.env.PATH ?? '',
        NGINX_TEMPLATE: repoFile('./docker/nginx.conf.template'),
        NGINX_CONF: output,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    return readFileSync(output, 'utf8')
  }

  it('substitutes the keys and leaves nginx’s own variables alone', () => {
    const rendered = render(ENV)

    expect(rendered).toContain('set $upstream_args "apiKey=newsapi-secret&$args"')
    expect(rendered).toContain('set $upstream_args "api-key=guardian-secret&$args"')
    expect(rendered).toContain('set $upstream_args "api-key=nyt-secret&$args"')
    // The trap this guards: envsubst with no variable list eats these too.
    expect(rendered).toContain('try_files $uri $uri/ /index.html')
    expect(rendered).toContain('$upstream_path$is_args$args')
    expect(rendered).not.toContain('${')
  })

  /**
   * A key with url-significant characters is the case where dev and container could silently
   * disagree: the dev proxy percent-encodes, so the container has to as well or the query
   * string splits at the first `&`.
   */
  it('percent-encodes the key the same way the dev proxy does', () => {
    const raw = "a+b&c=d#e f/g'h"
    const rendered = render({ ...ENV, GUARDIAN_KEY: raw })
    const encoded = withKey('/x', 'api-key', raw).slice('/x?api-key='.length)

    expect(encoded).toBe("a%2Bb%26c%3Dd%23e%20f%2Fg'h")
    expect(rendered).toContain(`set $upstream_args "api-key=${encoded}&$args"`)
  })

  it('renders a usable config when only the keyless source is configured', () => {
    const rendered = render({})

    expect(rendered).toContain('set $upstream_args "apiKey=&$args"')
    expect(rendered).toContain('proxy_pass https://feeds.bbci.co.uk/$upstream_path$is_args$args')
  })
})
