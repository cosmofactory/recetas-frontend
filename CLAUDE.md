# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**recetas-frontend** is the public website of Asadorov, a non-profit atlas of Spanish cooking. It's a SvelteKit 3 app (Svelte 5, TypeScript strict) built with `@sveltejs/adapter-node`. It is the only public entry point: Caddy proxies to it, and it talks to the Go API over the internal Docker network (`../specs/stack.md` X4).

Before working on anything user-facing, read `../CLAUDE.md` (workspace rules, domain model, search semantics) and the relevant design README: mobile `../design/design_handoff_asadorov_mvp/README.md` below 860px, desktop `../design/design_handoff_asadorov_desktop/README.md` from 860px. Check `../specs/stack.md` before adding a library, and read the current stage file in `../specs/stages/frontend/` before starting work.

## Commands

Node 24 (`.nvmrc`) and pnpm (pinned via `packageManager`; `corepack enable` once).

| What                                                 | Command                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Dev server                                           | `pnpm dev`                                                                                      |
| Lint (ESLint + Prettier check)                       | `pnpm lint`                                                                                     |
| Format                                               | `pnpm format`                                                                                   |
| Type check (svelte-check, warnings fail)             | `pnpm check`                                                                                    |
| Unit + component tests                               | `pnpm test`                                                                                     |
| Single test file / name                              | `pnpm vitest run src/routes/healthz/server.spec.ts` / `pnpm vitest run -t 'returns 200'`        |
| Build / run the production server                    | `pnpm build` / `PUBLIC_ORIGIN=http://localhost:3000 pnpm start`                                 |
| E2E (builds, starts `node build` on :4173)           | `pnpm test:e2e` (first time: `pnpm test:e2e:install`)                                           |
| One E2E project                                      | `pnpm test:e2e --project chromium-mobile-390`                                                   |
| Token drift vs design (local only)                   | `pnpm tokens:check` (the design bundle is outside this repo)                                    |
| Regenerate `messages/*.json` (local only)            | `pnpm strings:import` (after the design `strings.json` or `extra-strings.json` changes)         |
| Hard-coded string check (part of lint)               | `pnpm check:strings`                                                                            |
| Compile Paraglide messages                           | `pnpm i18n:compile` (the Vite plugin, `prepare` and `check` run it too)                         |
| Refresh the vendored API spec, types and mock bundle | `pnpm api:sync` (`API_SPEC_URL` / `API_BUNDLE_URL` = file or URL; default `../recetas-backend`) |
| API contract and bundle drift vs backend `main` (CI) | `pnpm api:check`                                                                                |

CI (`.github/workflows/ci.yml`) runs lint → check → api:check → test → build, then the Playwright smoke on every project. On pushes to `main` (and `v*` tags) it then pushes `ghcr.io/cosmofactory/recetas-frontend:sha-<7>` (plus `:vX.Y.Z`); no `:latest`. The deploy trigger arrives with INF-2. A change is done when `pnpm lint && pnpm check && pnpm test && pnpm build` pass.

Tests: unit tests are `*.spec.ts` (Node), component tests `*.svelte.spec.ts` (Vitest browser mode, Chromium), E2E `*.e2e.ts` (Playwright). Playwright projects cover mobile 390/360/430 and desktop 860/1280/1440 on Chromium, plus WebKit (iPhone, desktop 1440) and Firefox (1280).

## Rules

- **Svelte 5 runes only**: `$state`, `$derived`, `$props`, `$effect`. Never `export let`, `$:`, or stores for component state. Runes mode is forced in `vite.config.ts`.
- **Tokens are the only source of visual values.** Colours, type, spacing, radii and shadows come from `src/lib/styles/tokens.css`, which mirrors the design `tokens.css`. Never hard-code or round a value.
- **No hard-coded user-visible strings.** Every string is a Paraglide message, `m.*()` from `#lib/paraglide/messages.js`. Messages come from `../design/design_handoff_asadorov_desktop/strings.json` via `pnpm strings:import`; copy the design lacks (e.g. error pages) goes in `src/lib/i18n/extra-strings.json`, never straight into `messages/` (generated, committed) or markup. Keys are the strings.json path joined with `_` (`home.filterLabels["With pork"]` → `home_filterLabels_withPork`); plurals take `{ count }` and include the number. `pnpm check:strings` fails on literal text and literal `alt`/`aria-label`/`placeholder`/`title`; only the logo "Asadorov" is allowed.
- **i18n routing (F7, X6):** every page lives under `src/routes/[lang=lang]/` (matcher in `src/params.ts`). The URL path alone decides the language: `hooks.server.ts` takes it from the path (en for paths without a locale) and sets `<html lang>`. Every internal link uses `localizedHref(path, lang)` from `#lib/i18n/localized-href.ts`; a raw `href="/…"` fails `pnpm check:strings`. Numbers and units use `formatNumber`/`unitLabel` (`#lib/i18n/format.ts`), never string building.
- **Env (Kit 3):** runtime variables are declared in `src/env.ts` (`defineEnvVars`) and read from `$app/env/private` / `$app/env/public`; `$env/dynamic/*` is deprecated and only sees declared variables. `PUBLIC_ORIGIN` (e.g. `https://demo.asadorov.es`) is required outside `vite dev`: canonical and hreflang URLs use it, never the request Host. adapter-node 6 has no `ORIGIN` variable. `DATA_SOURCE` and `BACKEND_API_BASE_URL`: see Data source below.
- **Cookies and storage (X6):** the only cookie is `lang`, set server-side by `/set-lang` (FE-1). No `document.cookie`, `localStorage`, `sessionStorage` or `indexedDB`; ESLint enforces this. No browser analytics or telemetry.
- **Responsive (F6):** keep content components separate from layout containers; state lives in the URL; no hard-coded phone pixel widths; branch on input capability (`hover`, `pointer`) rather than width where it's about interaction. Breakpoint 860px, content max-width 1440px.
- **Data loading is server-only** (FE-2, X4). Loaders in `+page.server.ts` / `+layout.server.ts` call `catalog()` from `#lib/server/catalog.ts` (one process-wide `CatalogSource`, so the list cache is shared) and wrap every call in `orHttpError` (`#lib/server/load-errors.ts`): unknown key → 404, backend down → 503, both localised by `+error.svelte`. The `[lang=lang]` layout provides the `regions` and `dishes` lists; detail pages load their own region, dish or recipe. Types come from `src/lib/api/schema.d.ts`, generated from the vendored `src/lib/api/openapi.yaml` (never edit either by hand; `pnpm api:sync`). ESLint forbids `openapi-fetch` and global `fetch` outside `src/lib/server/`; server routes use `event.fetch`, except `/readyz`, which uses the global fetch (via `checkBackendReady`) because `event.fetch` re-wraps the request and its timeout signal can be garbage-collected (`timeout-under-gc.spec.ts`). Pass a timeout as `fetch(request, { signal })`, never inside `new Request(…, { signal })`, for the same reason. The browser never calls the Go API.
- **Data source:** `DATA_SOURCE=api` (default) reads the Go API at `BACKEND_API_BASE_URL` (internal origin, e.g. `http://backend:8080`; required outside `vite dev`, which defaults to `http://localhost:8080`). `DATA_SOURCE=mock` serves the vendored backend import bundle `src/lib/server/mock/content.bundle.json` (a copy of `recetas-backend/testdata/content.design.json`), for local dev and tests; Playwright runs with it, so E2E needs no backend. `src/env.ts` decides whether `BACKEND_API_BASE_URL` is required from the raw `process.env.DATA_SOURCE` (a schema can't see another variable's parsed value); under `vite dev` a `DATA_SOURCE` set only in `.env` isn't seen there, which only means the dev default URL is filled in. `/healthz` is liveness only; `/readyz` is 200 only when the backend `/healthz` answers, and 503 when no backend is configured (`BACKEND_API_BASE_URL` unset, e.g. in mock mode).
- Self-hosted fonts only; no request may go to a third-party origin.
- **Clean code** (root `CLAUDE.md`): ESLint enforces `max-lines-per-function` 30 (off in test files, where case tables live), `max-params` 4 and `max-depth` 2. Keep Svelte components small and presentational; put logic in `.ts` modules. Import `.ts` modules with their extension (`#lib/i18n/locales.ts`), so scripts also run natively in Node.
