#!/bin/sh
# Render the nginx config from the environment, then hand the container over to nginx.
#
# The keys exist only here and in the rendered config inside the running container. They are
# never baked into the image and never reach the bundle.
set -eu

TEMPLATE="${NGINX_TEMPLATE:-/etc/nginx/templates/nginx.conf.template}"
OUTPUT="${NGINX_CONF:-/etc/nginx/conf.d/default.conf}"

# An empty key is a misconfiguration, not a crash: BBC needs no key at all, so the container
# is still useful. Say so loudly rather than letting it look like a provider outage.
for name in NEWSAPI_KEY GUARDIAN_KEY NYT_KEY; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || echo "entrypoint: $name is empty — that provider will answer 401" >&2
done

# The key is substituted into a query string, so it has to arrive percent-encoded — a key
# containing & + = or # would otherwise split the query or truncate it. vite.proxy.ts's withKey()
# runs the key through encodeURIComponent for the dev proxy; this is the same escaping, so a key
# with url-significant characters behaves identically in dev and in the container.
#
# ponytail: printable ASCII only (keys are). A byte outside 32..126 encodes as %00; widen the
# ord[] table if a provider ever issues a non-ASCII key.
urlencode() {
  printf '%s' "${1:-}" | awk '
    BEGIN {
      for (i = 32; i < 127; i++) ord[sprintf("%c", i)] = i
      # encodeURIComponent leaves exactly these unescaped. \047 is the apostrophe.
      safe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*\047()"
    }
    {
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (index(safe, c) > 0) printf "%s", c
        else printf "%%%02X", ord[c]
      }
    }'
}

NEWSAPI_KEY=$(urlencode "${NEWSAPI_KEY:-}")
GUARDIAN_KEY=$(urlencode "${GUARDIAN_KEY:-}")
NYT_KEY=$(urlencode "${NYT_KEY:-}")
export NEWSAPI_KEY GUARDIAN_KEY NYT_KEY

# The explicit variable list is what keeps envsubst away from nginx's own $variables.
envsubst '${NEWSAPI_KEY} ${GUARDIAN_KEY} ${NYT_KEY}' <"$TEMPLATE" >"$OUTPUT"

# `render-only` lets the rendering be exercised without starting a server (see the tests).
if [ "${1:-}" = "render-only" ]; then
  exit 0
fi

exec nginx -g 'daemon off;'
