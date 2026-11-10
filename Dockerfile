# Smart Branch backoffice (React + Vite, CoreUI) — production image for a Linux host.
#
# Vite compiles the app to static files; nginx serves them on port 4000 and forwards /api/* to
# the backend with the same contract as the Vite dev/preview proxy:
#   /api/api/login  →  http://backend:5000/api/login      (see docker/nginx.conf)
# This replaces `vite preview`, which Vite documents as not meant for production.
#
# Build time: VITE_FINGERPRINT_WS_URL is compiled into the browser code (build arg).
# Run time: nothing to configure — no secrets live in this image.

# Full image (python3/make/g++ preinstalled) in case a dependency has to compile something.
ARG BUILD_IMAGE=node:22-bookworm
# Official NGINX image that runs as a non-root user.
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine

# ── Build ────────────────────────────────────────────────────────────────────────
FROM ${BUILD_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# The repository ignores package-lock.json, so npm install resolves the newest versions that
# package.json allows at build time. Commit a package-lock.json for repeatable builds: this
# step then switches to `npm ci` automatically.
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
COPY . .
ARG VITE_FINGERPRINT_WS_URL
ENV VITE_FINGERPRINT_WS_URL=${VITE_FINGERPRINT_WS_URL}
# The check makes a build that exits cleanly without its output fail here, instead of being
# cached as a success and only noticed (or not) later.
RUN npm run build && test -f build/index.html

# ── Runtime ──────────────────────────────────────────────────────────────────────
FROM ${NGINX_IMAGE}
ENV TZ=Africa/Addis_Ababa
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4000/healthz || exit 1
