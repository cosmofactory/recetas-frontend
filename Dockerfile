# syntax=docker/dockerfile:1.7

# ---------- Build ----------
FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /src

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Runtime node_modules: only `dependencies` (@opentelemetry/api, which Kit
# keeps external so the app and src/instrumentation.server.ts share one
# global tracer provider).
FROM node:24-alpine AS deps

RUN corepack enable
WORKDIR /src

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts


# ---------- Runtime ----------
FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/cosmofactory/recetas-frontend"

# Runtime configuration (compose):
#   PUBLIC_ORIGIN  required, e.g. https://demo.asadorov.es. Canonical and
#                  hreflang URLs are built from it (src/env.ts); the server
#                  refuses to start without it. adapter-node 6 no longer reads
#                  ORIGIN; the request origin comes from the Host header.
#   BACKEND_API_BASE_URL  required, the internal API origin, e.g.
#                  http://backend:8080 (never public, stack.md X4).
#   DATA_SOURCE    optional, `api` (default) or `mock` (tests only).
#   MEDIA_BASE_URL optional until INF-4, the CloudFront base photos are
#                  built against (https, optional path, stack.md X3). Unset:
#                  every photo renders as the placeholder.
#   LOGFIRE_TOKEN  optional, the Logfire write token (INF-3). Unset: server
#                  telemetry is off. Set: OTEL_EXPORTER_OTLP_ENDPOINT (https,
#                  the Logfire regional base URL) and APP_ENV (local, demo or
#                  prod) are required too; the server refuses to start
#                  without them (stack.md B7).
#   OTEL_SERVICE_NAME optional, default recetas-frontend.
#   APP_VERSION    baked in from the VERSION build arg (service.version).
ARG VERSION=dev
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${VERSION}

WORKDIR /app

# adapter-node bundles everything not listed in `dependencies`, so the runtime
# needs the build output, package.json ("type") and the production deps.
COPY --from=build --chown=node:node /src/package.json ./package.json
COPY --from=deps --chown=node:node /src/node_modules ./node_modules
COPY --from=build --chown=node:node /src/build ./build

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "build"]
