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


# ---------- Runtime ----------
FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/cosmofactory/recetas-frontend"

# Runtime configuration (compose):
#   PUBLIC_ORIGIN  required, e.g. https://demo.asadorov.es. Canonical and
#                  hreflang URLs are built from it (src/env.ts); the server
#                  refuses to start without it. adapter-node 6 no longer reads
#                  ORIGIN; the request origin comes from the Host header.
ARG VERSION=dev
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${VERSION}

WORKDIR /app

# adapter-node bundles everything not listed in `dependencies`, and there are
# none, so the runtime needs only the build output and package.json ("type").
COPY --from=build --chown=node:node /src/package.json ./package.json
COPY --from=build --chown=node:node /src/build ./build

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "build"]
