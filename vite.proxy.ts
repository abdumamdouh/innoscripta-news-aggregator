/**
 * Where every `/api/*` path goes and which query parameter carries that provider's key.
 *
 * Build-time only: imported by `vite.config.ts` for the dev server and mirrored, location
 * for location, by `docker/nginx.conf.template` for the container. The key is attached by
 * the proxy in both environments, so the adapters call identical paths and never see one —
 * nothing here is reachable from the browser bundle.
 */

export interface ProxyRoute {
  /** Upstream origin plus the path prefix the provider's own API lives under. */
  target: string
  /** Query parameter the provider expects its key in. Absent means the source needs no key. */
  param?: string
  /** Env var holding the key. Absent means the source needs no key (BBC publishes open RSS). */
  env?: string
}

/**
 * One entry per source. `param` differs per provider — NewsAPI documents `apiKey`, the
 * Guardian and NYT both use `api-key` — which is exactly why it lives in a table instead of
 * being hardcoded twice.
 */
export const PROXY_ROUTES: Record<string, ProxyRoute> = {
  // NewsAPI's free tier refuses browser requests from anything but localhost (CORS).
  '/api/newsapi': { target: 'https://newsapi.org/v2', param: 'apiKey', env: 'NEWSAPI_KEY' },
  '/api/guardian': {
    target: 'https://content.guardianapis.com',
    param: 'api-key',
    env: 'GUARDIAN_KEY',
  },
  '/api/nyt': { target: 'https://api.nytimes.com/svc/search/v2', param: 'api-key', env: 'NYT_KEY' },
  // BBC publishes RSS, not an API, and sends no CORS headers at all. No key exists for it.
  '/api/bbc': { target: 'https://feeds.bbci.co.uk' },
}

/**
 * Append `param=key` to an already-built path. A missing key leaves the path untouched
 * rather than sending `api-key=undefined`: the provider's 401 is a far clearer signal than
 * a request that looks authenticated and is not.
 */
export function withKey(path: string, param?: string, key?: string): string {
  if (!param || !key) return path
  return `${path}${path.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(key)}`
}

/** Vite dev-server `server.proxy`, built from the same table nginx is generated against. */
export function createProxy(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(PROXY_ROUTES).map(([prefix, route]) => [
      prefix,
      {
        target: route.target,
        changeOrigin: true,
        rewrite: (path: string) =>
          withKey(path.slice(prefix.length), route.param, route.env ? env[route.env] : undefined),
      },
    ]),
  )
}

/**
 * Resolve a caller-supplied path against a route's target, or reject it.
 *
 * The path arrives from the query string on Vercel, and `fetch` resolves dot segments before
 * it sends anything — so `../../../svc/topstories/v2/home.json` reaches an endpoint the route
 * never configured, signed with our key, turning the deployment into a free proxy for someone
 * else's traffic. `new URL` normalizes first, so comparing after resolution tests where the
 * request will actually go rather than the string we assembled.
 *
 * nginx and the Vite dev server both normalize the URI before matching a location, so this is
 * the one runtime that has to check for itself.
 */
export function resolveUpstream(target: string, path: string): URL | undefined {
  const base = new URL(target.endsWith('/') ? target : `${target}/`)
  let resolved: URL
  try {
    resolved = new URL(path.replace(/^\/+/, ''), base)
  } catch {
    return undefined
  }

  const contained = resolved.origin === base.origin && resolved.pathname.startsWith(base.pathname)
  return contained ? resolved : undefined
}
