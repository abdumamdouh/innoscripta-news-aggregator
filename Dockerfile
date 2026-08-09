# Build the bundle with node, serve it with nginx. Two stages so the image that ships is
# nginx + static files — no node, no node_modules, no sources.
#
# The provider keys are NOT here on purpose: no ARG, no ENV, nothing COPYd in. They arrive at
# container start as environment variables and are rendered into the nginx config by
# docker/entrypoint.sh, exactly as in dev where vite.proxy.ts attaches them. That is what keeps
# `grep -r VITE_ dist/` (and a grep for the key itself) empty.

# Matches .nvmrc.
FROM node:20-alpine AS build
WORKDIR /app

# package*.json first so a source-only edit reuses the cached install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# nginx:alpine already carries the gettext binary the entrypoint renders the template with —
# it is what the image's own /etc/nginx/templates mechanism uses. No extra package needed.
FROM nginx:1.29-alpine AS serve

COPY docker/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY docker/entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint-custom.sh"]
