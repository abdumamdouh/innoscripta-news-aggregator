import { PROXY_ROUTES, withKey } from '../vite.proxy.ts'

/**
 * The third consumer of `PROXY_ROUTES`, after the Vite dev server and the nginx container.
 * Vercel serves the bundle statically and has no nginx, so without this every `/api/*` call
 * 404s and all four sources go dark — BBC included, which needs the hop for CORS rather than
 * for a key.
 *
 * The key is attached here, on the server, and the upstream response is streamed back
 * verbatim. Nothing about it reaches the browser.
 */
export const config = { runtime: 'edge' }

const CACHE_SECONDS = 60

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)

  const prefix = Object.keys(PROXY_ROUTES).find(
    (candidate) => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`),
  )
  const route = prefix ? PROXY_ROUTES[prefix] : undefined
  if (!prefix || !route) {
    return new Response(JSON.stringify({ error: 'Unknown source' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Same shape the dev proxy builds: strip the prefix, keep the query, append the key.
  const rest = `${url.pathname.slice(prefix.length)}${url.search}`
  const key = route.env ? process.env[route.env] : undefined
  const upstream = `${route.target}${withKey(rest, route.param, key)}`

  try {
    const response = await fetch(upstream, {
      headers: {
        // NewsAPI rejects requests without one; the others are indifferent.
        'user-agent': 'innoscripta-news-aggregator',
        accept: request.headers.get('accept') ?? '*/*',
      },
      signal: request.signal,
    })

    // Pass the provider's own status through — a 401 from a missing key has to stay a 401,
    // otherwise the partial-failure banner cannot tell the reader which source is unconfigured.
    const headers = new Headers()
    const contentType = response.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    if (response.ok) {
      headers.set('cache-control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`)
    }

    return new Response(response.body, { status: response.status, headers })
  } catch (error) {
    // An upstream that never answers is one failed source, not a broken deployment.
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Upstream failed' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }
}
