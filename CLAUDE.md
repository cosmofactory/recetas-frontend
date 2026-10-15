# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**recetas-frontend** is the public website of Asadorov, a non-profit atlas of Spanish cooking. It's a SvelteKit 3 app (Svelte 5, TypeScript strict) built with `@sveltejs/adapter-node`. It is the only public entry point: Caddy proxies to it, and it talks to the Go API over the internal Docker network (`../specs/stack.md` X4).

Before working on anything user-facing, read `../CLAUDE.md` (workspace rules, domain model, search semantics) and the relevant design README: mobile `../design/design_handoff_asadorov_mvp/README.md` below 860px, desktop `../design/design_handoff_asadorov_desktop/README.md` from 860px. Check `../specs/stack.md` before adding a library, and read the current stage file in `../specs/stages/frontend/` before starting work.

## Commands

Node 24 (`.nvmrc`) and pnpm (pinned via `packageManager`; `corepack enable` once).

| What                                       | Command                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Dev server                                 | `pnpm dev`                                                                               |
| Lint (ESLint + Prettier check)             | `pnpm lint`                                                                              |
| Format                                     | `pnpm format`                                                                            |
| Type check (svelte-check, warnings fail)   | `pnpm check`                                                                             |
| Unit + component tests                     | `pnpm test`                                                                              |
| Single test file / name                    | `pnpm vitest run src/routes/healthz/server.spec.ts` / `pnpm vitest run -t 'returns 200'` |
| Build / run the production server          | `pnpm build` / `ORIGIN=http://localhost:3000 pnpm start`                                 |
| E2E (builds, starts `node build` on :4173) | `pnpm test:e2e` (first time: `pnpm test:e2e:install`)                                    |
| One E2E project                            | `pnpm test:e2e --project chromium-mobile-390`                                            |
| Token drift vs design (local only)         | `pnpm tokens:check` (the design bundle is outside this repo)                             |

CI (`.github/workflows/ci.yml`) runs lint → check → test → build, then the Playwright smoke on every project. On pushes to `main` (and `v*` tags) it then pushes `ghcr.io/cosmofactory/recetas-frontend:sha-<7>` (plus `:vX.Y.Z`); no `:latest`. The deploy trigger arrives with INF-2. A change is done when `pnpm lint && pnpm check && pnpm test && pnpm build` pass.

Tests: unit tests are `*.spec.ts` (Node), component tests `*.svelte.spec.ts` (Vitest browser mode, Chromium), E2E `*.e2e.ts` (Playwright). Playwright projects cover mobile 390/360/430 and desktop 860/1280/1440 on Chromium, plus WebKit (iPhone, desktop 1440) and Firefox (1280).

## Rules

- **Svelte 5 runes only**: `$state`, `$derived`, `$props`, `$effect`. Never `export let`, `$:`, or stores for component state. Runes mode is forced in `vite.config.ts`.
- **Tokens are the only source of visual values.** Colours, type, spacing, radii and shadows come from `src/lib/styles/tokens.css`, which mirrors the design `tokens.css`. Never hard-code or round a value.
- **No hard-coded user-visible strings.** Every string comes from the i18n messages (FE-1), sourced from `../design/design_handoff_asadorov_desktop/strings.json`.
- **Cookies and storage (X6):** the only cookie is `lang`, set server-side by `/set-lang` (FE-1). No `document.cookie`, `localStorage`, `sessionStorage` or `indexedDB`; ESLint enforces this. No browser analytics or telemetry.
- **Responsive (F6):** keep content components separate from layout containers; state lives in the URL; no hard-coded phone pixel widths; branch on input capability (`hover`, `pointer`) rather than width where it's about interaction. Breakpoint 860px, content max-width 1440px.
- **Data loading is server-only** (`+page.server.ts` / `+layout.server.ts`, FE-2). The browser never calls the Go API directly.
- Self-hosted fonts only; no request may go to a third-party origin.
- **Clean code** (root `CLAUDE.md`): ESLint enforces `max-lines-per-function` 30 (off in test files, where case tables live), `max-params` 4 and `max-depth` 2. Keep Svelte components small and presentational; put logic in `.ts` modules.
