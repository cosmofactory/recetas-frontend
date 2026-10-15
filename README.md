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
PUBLIC_ORIGIN=http://localhost:3000 pnpm start   # PUBLIC_ORIGIN is required (src/env.ts)
```

## UI strings

Pages live under `/en/`, `/es/` and `/ru/`. UI copy is compiled by Paraglide JS from `messages/{en,es,ru}.json`, which `pnpm strings:import` generates from the design `strings.json` plus `src/lib/i18n/extra-strings.json`. Don't edit `messages/` by hand.

See `CLAUDE.md` for conventions and `../specs/` for the roadmap.
