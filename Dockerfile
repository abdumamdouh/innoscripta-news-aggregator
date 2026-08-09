# Two stages: node builds the static bundle, nginx serves it and attaches the provider keys.
#
# The keys are runtime-only. They are never build args and never COPYd in — docker/entrypoint.sh
# renders them into the nginx config from the container's environment at start, which is what
# keeps item 4's promise ("no key in dist/") true for the image too.

FROM node:20-alpine AS build
WORKDIR /app
# package files first so `npm ci` re-runs only when a dependency actually changed.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
# nginx:alpine ships envsubst already (it is what its own template mechanism uses), so
# entrypoint.sh needs nothing installed. We replace that mechanism rather than use it:
# ours percent-encodes the keys first, exactly as the dev proxy does.
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
