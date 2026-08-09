import { PROXY_ROUTES, withKey } from '../vite.proxy'

/**
 * The third consumer of `PROXY_ROUTES`, after the Vite dev server and the nginx container.
 * Vercel serves the bundle statically and has no nginx, so without this every `/api/*` call
 * 404s and all four sources go dark — BBC included, which needs the hop for CORS rather than
 * for a key.
 *
 * The browser still calls `/api/<source>/<rest>`, exactly as it does in dev and in the
 * container. `vercel.json` rewrites that onto this one function and hands it the two pieces
 * as `__source` and `__path`; a filesystem catch-all (`api/[...path].ts`) built and deployed
 * but matched no request, so the routing is spelled out instead of inferred.
 *
 * The key is attached here, on the server, and the upstream response is streamed back
 * verbatim. Nothing about it reaches the browser.
 */
export const config = { runtime: 'edge' }

const CACHE_SECONDS = 60

/** Set by the rewrite, not by the caller — they must never reach the provider. */
const ROUTING_PARAMS = ['__source', '__path']

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)

  const source = url.searchParams.get('__source')
  const path = url.searchParams.get('__path') ?? ''
  const route = source ? PROXY_ROUTES[`/api/${source}`] : undefined
  if (!route) return json({ error: `Unknown source: ${source ?? '(none)'}` }, 404)

  const forwarded = new URLSearchParams(url.searchParams)
  for (const param of ROUTING_PARAMS) forwarded.delete(param)

  const query = forwarded.toString()
  const key = route.env ? process.env[route.env] : undefined
  const upstream = `${route.target}/${path}${withKey(query ? `?${query}` : '', route.param, key)}`

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
    return json({ error: error instanceof Error ? error.message : 'Upstream failed' }, 502)
  }
}
