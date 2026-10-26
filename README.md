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
# PUBLIC_ORIGIN and APP_ENV are required (src/env.ts); so is BACKEND_API_BASE_URL unless DATA_SOURCE=mock.
APP_ENV=local PUBLIC_ORIGIN=http://localhost:3000 BACKEND_API_BASE_URL=http://localhost:8080 pnpm start
APP_ENV=local PUBLIC_ORIGIN=http://localhost:3000 DATA_SOURCE=mock pnpm start   # no backend: the vendored content bundle
```

| Variable                      | Required                 | Notes                                                                        |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`               | yes (outside `vite dev`) | canonical and hreflang URLs, e.g. `https://demo.asadorov.es`                 |
| `DATA_SOURCE`                 | no                       | `api` (default) or `mock` (local dev and tests only)                         |
| `BACKEND_API_BASE_URL`        | when `DATA_SOURCE=api`   | internal Go API origin, e.g. `http://backend:8080`; dev default `:8080`      |
| `MEDIA_BASE_URL`              | no (until INF-4)         | CloudFront base for photos, https with an optional path; unset: placeholders |
| `LOGFIRE_TOKEN`               | no                       | Logfire write token; unset: server telemetry off (stack.md B7)               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | with `LOGFIRE_TOKEN`     | Logfire regional OTLP base URL, https; traces go to `<url>/v1/traces`        |
| `APP_ENV`                     | yes (outside `vite dev`) | `local`, `demo` or `prod`; only `prod` is indexable (robots, X-Robots-Tag)   |
| `OTEL_SERVICE_NAME`           | no                       | default `recetas-frontend`                                                   |
| `APP_VERSION`                 | no                       | `service.version`; the Dockerfile sets it from the image tag (default `dev`) |

## API contract

`src/lib/api/openapi.yaml` is vendored from `recetas-backend/api/openapi.yaml`, and `schema.d.ts` is generated from it. The mock data source's `src/lib/server/mock/content.bundle.json` is vendored from `recetas-backend/testdata/content.design.json`. `pnpm api:sync` refreshes all three (from `../recetas-backend`, or `API_SPEC_URL` / `API_BUNDLE_URL`); `pnpm api:check` (run in CI) fails when they drift from the backend's `main`.

## UI strings

Pages live under `/en/`, `/es/` and `/ru/`. UI copy is compiled by Paraglide JS from `messages/{en,es,ru}.json`, which `pnpm strings:import` generates from the design `strings.json` plus `src/lib/i18n/extra-strings.json`. Don't edit `messages/` by hand.

## Deploy

On a push to `main`, CI pushes `ghcr.io/cosmofactory/recetas-frontend:sha-<7>`, and the **Deploy Demo** job runs `/srv/recetas/scripts/deploy-service.sh demo frontend sha-<7>` on the VM over ssh, then `curl -fsSL` against `https://demo.asadorov.es/` and `/readyz` (bounded retries). The job fails when the new image doesn't turn healthy (the VM brings the previous tag back) or the smoke fails. The key is restricted on the VM to recetas-infra's `ssh-gate.sh frontend demo`, which runs only that command; a failed rollout's container logs stay in `/srv/recetas/demo/deploy.log` on the VM.

Rollback: re-run only the `Deploy Demo` job of an older run, never "Re-run all jobs" (that rebuilds and re-pushes the same `sha-` tag). Or, as the owner (logged in as `admin`, then `sudo -iu deploy`), `/srv/recetas/scripts/deploy-service.sh demo frontend sha-<old>`.

Owner setup, once the VM exists (INF-0):

- GitHub environment **`demo`** (Settings → Environments), deployment branches limited to `main`, with the secrets:

  | Secret            | Value                                                                                        |
  | ----------------- | -------------------------------------------------------------------------------------------- |
  | `SSH_HOST`        | Terraform output `vm_ipv4`                                                                   |
  | `SSH_USER`        | `deploy`                                                                                     |
  | `SSH_PRIVATE_KEY` | Private half of `frontend_demo_deploy_ssh_public_key` (this repo's own key, gated on the VM) |
  | `SSH_KNOWN_HOSTS` | `ssh-keyscan <vm>` output, taken from a trusted machine                                      |

- This repo's own repository variable **`DEPLOY_ENABLED=true`** (Settings → Secrets and variables → Actions → Variables). Until then the job is skipped. Set it only once recetas-infra's first demo deploy has installed `/srv/recetas/scripts` and `/srv/recetas/demo/tags.env` names both `BACKEND_IMAGE_TAG` and `FRONTEND_IMAGE_TAG` (recetas-infra README, First demo deploy): the demo compose file requires both, so a deploy with either tag missing fails at compose validation.

`pnpm lint:actions` lints the workflows locally (actionlint in Docker, the same pinned image as recetas-infra and recetas-backend).

See `CLAUDE.md` for conventions and `../specs/` for the roadmap.
