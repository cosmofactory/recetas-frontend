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

See `CLAUDE.md` for conventions and `../specs/` for the roadmap.
