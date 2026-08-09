import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The image, the compose file and the CI workflow are declarative, so what can actually break
 * is the seams between them and the files they lean on: the paths docker/entrypoint.sh defaults
 * to, the key names .env.example declares, the scripts package.json exposes, the Node version
 * .nvmrc pins. Each of those is a cross-file contract that no single file can enforce alone —
 * and one of them silently drifting is how a container starts serving a stale bundle, or a key
 * ends up baked into a layer.
 */
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const dockerfile = read('./Dockerfile')
const compose = read('./docker-compose.yml')
const dockerignore = read('./.dockerignore')
const workflow = read('./.github/workflows/ci.yml')
const entrypoint = read('./docker/entrypoint.sh')
const envExample = read('./.env.example')
const scripts = JSON.parse(read('./package.json')).scripts as Record<string, string>

const KEYS = ['NEWSAPI_KEY', 'GUARDIAN_KEY', 'NYT_KEY']

/** `COPY <src> <dest>` pairs, ignoring `--from=` and other flags. */
const copies = [...dockerfile.matchAll(/^COPY\s+(?:--\S+\s+)*(.+)$/gm)].map((match) => {
  const parts = match[1]!.trim().split(/\s+/)
  return { sources: parts.slice(0, -1), dest: parts.at(-1)! }
})

/** The default value of `VAR` in `"${VAR:-default}"`, as entrypoint.sh writes them. */
const shellDefault = (name: string) =>
  entrypoint.match(new RegExp(`\\$\\{${name}:-([^}]+)\\}`))?.[1]

describe('Dockerfile', () => {
  it('builds on the Node major that .nvmrc pins', () => {
    expect(dockerfile).toMatch(new RegExp(`^FROM node:${read('./.nvmrc').trim()}[.-]`, 'm'))
  })

  it('ships nginx, not node — the build stage is left behind', () => {
    const stages = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((match) => match[1]!)
    expect(stages.length).toBeGreaterThan(1)
    expect(stages.at(-1)).toMatch(/^nginx:/)
    expect(copies.some((copy) => copy.dest === '/usr/share/nginx/html')).toBe(true)
  })

  it('puts item 4’s config exactly where entrypoint.sh looks for it', () => {
    const template = copies.find((copy) => copy.sources.includes('docker/nginx.conf.template'))
    expect(template?.dest).toBe(shellDefault('NGINX_TEMPLATE'))
  })

  it('runs item 4’s entrypoint rather than a second copy of its logic', () => {
    const script = copies.find((copy) => copy.sources.includes('docker/entrypoint.sh'))
    expect(script).toBeDefined()
    expect(dockerfile).toContain(`ENTRYPOINT ["${script!.dest}"]`)
    // Whatever renders the config, it is that script — the Dockerfile must not re-implement
    // the urlencode/envsubst dance.
    expect(dockerfile).not.toContain('envsubst')
  })

  it('never takes a provider key at build time — a key in a layer is a key in the registry', () => {
    for (const key of KEYS) {
      expect(dockerfile).not.toMatch(new RegExp(`^\\s*(ARG|ENV)\\s+${key}`, 'm'))
    }
    expect(dockerfile).not.toMatch(/^\s*(ARG|ENV)\s+VITE_/m)
    expect(copies.every((copy) => copy.sources.every((source) => !source.startsWith('.env')))).toBe(
      true,
    )
  })
})

describe('docker-compose.yml', () => {
  it('passes exactly the three keys .env.example declares, and passes them at run time', () => {
    for (const key of KEYS) {
      expect(envExample).toMatch(new RegExp(`^${key}=`, 'm'))
      expect(compose).toMatch(new RegExp(`^\\s*- ${key}$`, 'm'))
    }
    // Build args would bake the key into the image; `environment` reaches the running container.
    expect(compose).not.toMatch(/^\s*args:/m)
  })

  it('publishes a host port onto nginx’s port 80', () => {
    expect(compose).toMatch(/- '\$\{WEB_PORT:-\d+\}:80'/)
  })
})

describe('.dockerignore', () => {
  const ignored = dockerignore
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  it('keeps a locally built dist out of the context, so the image cannot serve a stale bundle', () => {
    expect(ignored).toContain('dist')
    expect(ignored).toContain('node_modules')
  })

  it('keeps env files out of the context while allowing the committed example', () => {
    expect(ignored).toContain('.env')
    expect(ignored).toContain('.env.*')
    expect(ignored).toContain('!.env.example')
  })

  it('leaves e2e/ in — tsconfig.node.json references it and the build runs tsc -b', () => {
    expect(ignored).not.toContain('e2e')
  })
})

describe('.github/workflows/ci.yml', () => {
  it('runs the same scripts a developer runs, by the names package.json defines', () => {
    for (const script of ['typecheck', 'lint', 'build']) {
      expect(scripts).toHaveProperty(script)
      expect(workflow).toMatch(new RegExp(`^\\s*- run: npm run ${script}$`, 'm'))
    }
    expect(scripts).toHaveProperty('test')
    expect(workflow).toMatch(/^\s*- run: npm test$/m)
  })

  it('builds the image and re-checks the key-leak grep from item 4', () => {
    expect(workflow).toMatch(/docker build/)
    expect(workflow).toMatch(/! grep -rn 'VITE_' dist\//)
  })

  it('installs the Node version .nvmrc pins instead of hardcoding one', () => {
    expect(workflow).toContain('node-version-file: .nvmrc')
    expect(workflow).not.toMatch(/node-version: /)
  })
})
