import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROXY_ROUTES } from './vite.proxy.ts'

/**
 * The image, the compose file and the CI workflow are three copies of the same handful of
 * facts — the Node version, where the bundle lives, which env vars carry the keys, which
 * scripts gate a merge. None of them is type-checked and none of them fails loudly when it
 * drifts from the others: a container that serves a stale root or a workflow that has
 * quietly stopped running the tests both look perfectly healthy.
 *
 * So the drift is what gets asserted, in the same spirit as the nginx/dev-proxy parity
 * tests in vite.proxy.test.ts. Every expectation below is derived from the file that owns
 * the fact, never restated by hand.
 */
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const dockerfile = read('./Dockerfile')
const compose = read('./docker-compose.yml')
const dockerignore = read('./.dockerignore')
const workflow = read('./.github/workflows/ci.yml')
const entrypoint = read('./docker/entrypoint.sh')
const template = read('./docker/nginx.conf.template')
const nodeVersion = read('./.nvmrc').trim()
const scripts = (JSON.parse(read('./package.json')) as { scripts: Record<string, string> }).scripts

/** The key env vars the nginx template actually consumes — the one true list. */
const KEY_VARS = [
  ...new Set([...template.matchAll(/\$\{(\w+)\}/g)].map((match) => match[1] as string)),
]

/** `.dockerignore` patterns, comments and blank lines dropped. */
const ignored = dockerignore
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

describe('Dockerfile', () => {
  it('pins the build stage to the Node version .nvmrc pins', () => {
    expect(dockerfile).toMatch(
      new RegExp(`^FROM node:${nodeVersion}(\\.\\d+)*-\\w+ AS build$`, 'm'),
    )
  })

  it('is multi-stage: node builds, nginx serves', () => {
    expect(dockerfile).toMatch(/^FROM nginx:/m)
    // The bundle is copied out of the build stage, not built in the serving image.
    expect(dockerfile).toMatch(/^COPY --from=build \/app\/dist /m)
    expect(dockerfile).toContain('RUN npm run build')
  })

  it('copies the bundle to the root the nginx config actually serves from', () => {
    const root = /^\s*root\s+(\S+);/m.exec(template)?.[1]
    expect(root).toBeDefined()
    expect(dockerfile).toContain(`COPY --from=build /app/dist ${root}`)
  })

  it('copies the template to the path entrypoint.sh reads by default', () => {
    const templatePath = /NGINX_TEMPLATE:-([^}]+)}/.exec(entrypoint)?.[1]
    expect(templatePath).toBeDefined()
    expect(dockerfile).toContain(`docker/nginx.conf.template ${templatePath}`)
  })

  it('runs entrypoint.sh, executable, at the path it copied it to', () => {
    const copied = /^COPY --chmod=0755 docker\/entrypoint\.sh (\S+)$/m.exec(dockerfile)?.[1]
    expect(copied).toBeDefined()
    expect(dockerfile).toContain(`ENTRYPOINT ["${copied}"]`)
  })

  it('bakes no key into the image — not as ARG, ENV or literal', () => {
    for (const name of KEY_VARS) expect(dockerfile).not.toContain(name)
    expect(dockerfile).not.toMatch(/^\s*(ARG|ENV)\s/m)
  })
})

describe('docker-compose.yml', () => {
  it('publishes the container port', () => {
    expect(compose).toMatch(/-\s*'\$\{WEB_PORT:-\d+}:80'/)
    expect(dockerfile).toContain('EXPOSE 80')
  })

  it('passes exactly the key vars the nginx template consumes', () => {
    const passed = /environment:\n((?:\s+\w+: \S+\n)+)/.exec(compose)?.[1] ?? ''
    const names = [...passed.matchAll(/^\s+(\w+): /gm)].map((match) => match[1] as string)
    expect(names.sort()).toEqual([...KEY_VARS].sort())
  })

  it('passes them at runtime, never as build args that would persist in the image', () => {
    expect(compose).not.toMatch(/^\s*args:\s*$/m)
    for (const name of KEY_VARS) {
      // Interpolated from the environment, never a literal — a value here would be a
      // committed key. `:-` keeps an unset key an empty string instead of a compose warning.
      expect(compose).toContain(`${name}: \${${name}:-}`)
    }
  })
})

describe('.dockerignore', () => {
  it('keeps every env file out of the build context', () => {
    expect(ignored).toContain('.env')
    expect(ignored).toContain('.env.*')
  })

  it('excludes what the image rebuilds or never needs', () => {
    for (const pattern of ['node_modules', 'dist', 'coverage', '.git']) {
      expect(ignored).toContain(pattern)
    }
  })

  it('keeps everything the build stage actually needs', () => {
    // `COPY . .` runs after `npm ci`, so anything ignored here is missing at build time.
    for (const needed of ['src', 'public', 'index.html', 'package.json', 'package-lock.json']) {
      expect(ignored).not.toContain(needed)
    }
    // docker/ is COPYd into the serving stage from the context, not from the build stage.
    expect(ignored).not.toContain('docker')
  })
})

describe('CI workflow', () => {
  it('takes its Node version from .nvmrc rather than a second copy of it', () => {
    expect(workflow).toContain('node-version-file: .nvmrc')
    expect(workflow).not.toContain(`node-version: ${nodeVersion}`)
  })

  it.each(['typecheck', 'lint', 'test', 'build'])('runs npm run %s', (script) => {
    expect(scripts).toHaveProperty(script)
    expect(workflow).toContain(`run: npm run ${script}`)
  })

  it('builds the image, so a broken Dockerfile fails the pipeline', () => {
    expect(workflow).toMatch(/run: docker build .*\.$/m)
  })

  it('re-runs item 4’s key-leak grep over the built bundle', () => {
    const grep = /! grep -rE '([^']+)' dist\//.exec(workflow)?.[1]
    expect(grep).toBeDefined()
    // Every key the template consumes has to be in the pattern, plus Vite's inlining prefix.
    for (const name of [...KEY_VARS, 'VITE_']) expect(grep).toContain(name)
  })
})

describe('the container and the dev proxy answer the same paths', () => {
  it.each(Object.keys(PROXY_ROUTES))('%s is served by the image, not only by vite', (prefix) => {
    // Nothing in the image re-declares routes; it inherits them by shipping the template.
    expect(template).toContain(`location ~ ^${prefix}/`)
    expect(dockerfile).toContain('docker/nginx.conf.template')
  })
})
