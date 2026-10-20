# recetas-frontend

The Asadorov website: SvelteKit 3 (Svelte 5, TypeScript) on Node 24, served by `@sveltejs/adapter-node` behind Caddy.

## Quick start

```bash
nvm use            # Node 24 from .nvmrc
corepack enable    # pnpm version from package.json
pnpm install
pnpm dev           # http://localhost:5173
```

## Checks

```bash
pnpm lint && pnpm check && pnpm test && pnpm build
pnpm test:e2e:install   # once: Playwright browsers
pnpm test:e2e
```

## Run the production build

```bash
pnpm build
# PUBLIC_ORIGIN is required (src/env.ts); so is BACKEND_API_BASE_URL unless DATA_SOURCE=mock.
PUBLIC_ORIGIN=http://localhost:3000 BACKEND_API_BASE_URL=http://localhost:8080 pnpm start
PUBLIC_ORIGIN=http://localhost:3000 DATA_SOURCE=mock pnpm start   # no backend: the vendored content bundle
```

| Variable                      | Required                 | Notes                                                                        |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`               | yes (outside `vite dev`) | canonical and hreflang URLs, e.g. `https://demo.asadorov.es`                 |
| `DATA_SOURCE`                 | no                       | `api` (default) or `mock` (local dev and tests only)                         |
| `BACKEND_API_BASE_URL`        | when `DATA_SOURCE=api`   | internal Go API origin, e.g. `http://backend:8080`; dev default `:8080`      |
| `MEDIA_BASE_URL`              | no (until INF-4)         | CloudFront base for photos, https with an optional path; unset: placeholders |
| `LOGFIRE_TOKEN`               | no                       | Logfire write token; unset: server telemetry off (stack.md B7)               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | with `LOGFIRE_TOKEN`     | Logfire regional OTLP base URL, https; traces go to `<url>/v1/traces`        |
| `APP_ENV`                     | with `LOGFIRE_TOKEN`     | `local`, `demo` or `prod` (`deployment.environment.name`)                    |
| `OTEL_SERVICE_NAME`           | no                       | default `recetas-frontend`                                                   |
| `APP_VERSION`                 | no                       | `service.version`; the Dockerfile sets it from the image tag (default `dev`) |

## API contract

`src/lib/api/openapi.yaml` is vendored from `recetas-backend/api/openapi.yaml`, and `schema.d.ts` is generated from it. The mock data source's `src/lib/server/mock/content.bundle.json` is vendored from `recetas-backend/testdata/content.design.json`. `pnpm api:sync` refreshes all three (from `../recetas-backend`, or `API_SPEC_URL` / `API_BUNDLE_URL`); `pnpm api:check` (run in CI) fails when they drift from the backend's `main`.

## UI strings

Pages live under `/en/`, `/es/` and `/ru/`. UI copy is compiled by Paraglide JS from `messages/{en,es,ru}.json`, which `pnpm strings:import` generates from the design `strings.json` plus `src/lib/i18n/extra-strings.json`. Don't edit `messages/` by hand.

See `CLAUDE.md` for conventions and `../specs/` for the roadmap.
