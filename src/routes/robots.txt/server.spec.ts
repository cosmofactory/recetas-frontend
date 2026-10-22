import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExport, repoFile } from '../../testutil/load-export';

// FE-8 PR 1 (stage FE-8 -> SEO, Acceptance "Demo responds with noindex and
// robots disallows everything. A local prod-mode build is indexable"):
// /robots.txt is a server route that reads APP_ENV at request time (never
// prerendered: the build has no runtime env).
// - demo (and local): `User-agent: *` + `Disallow: /`, and no Sitemap line
//   (nothing on demo is meant to be found).
// - prod: everything allowed, plus `Sitemap: <PUBLIC_ORIGIN>/sitemap.xml`.
//   The sitemap itself arrives in FE-8 PR 2; the line is written now so the
//   two PRs don't both touch this route.
// The body is text/plain.

const ROUTE = 'src/routes/robots.txt/+server.ts';
const PROD_ORIGIN = 'https://asadorov.es';

type Get = (event: unknown) => Response | Promise<Response>;

afterEach(() => {
	vi.doUnmock('$app/env/private');
});

async function robots(appEnv: string): Promise<{ res: Response; lines: string[] }> {
	vi.resetModules();
	vi.doMock('$app/env/private', () => ({ APP_ENV: appEnv, PUBLIC_ORIGIN: PROD_ORIGIN }));
	const GET = await loadExport<Get>(ROUTE, 'GET');
	const res = await GET({ url: new URL(`${PROD_ORIGIN}/robots.txt`) });
	return { res, lines: directives(await res.text()) };
}

// The directive lines, trimmed, without comments or blank lines.
function directives(body: string): string[] {
	return body
		.split('\n')
		.map((line) => line.replace(/#.*/, '').trim())
		.filter(Boolean);
}

const disallowAll = (lines: string[]) => lines.some((l) => /^disallow:\s*\/$/i.test(l));
const sitemaps = (lines: string[]) => lines.filter((l) => /^sitemap:/i.test(l));

describe('GET /robots.txt', () => {
	for (const appEnv of ['demo', 'local']) {
		it(`APP_ENV=${appEnv}: disallows everything for every user agent`, async () => {
			const { lines } = await robots(appEnv);
			expect(lines, `got ${JSON.stringify(lines)}`).toContain('User-agent: *');
			expect(disallowAll(lines), `got ${JSON.stringify(lines)}, want "Disallow: /"`).toBe(true);
		});

		it(`APP_ENV=${appEnv}: advertises no sitemap`, async () => {
			const { lines } = await robots(appEnv);
			expect(sitemaps(lines), `got ${JSON.stringify(lines)}, want no Sitemap line`).toEqual([]);
		});
	}

	it('APP_ENV=prod: allows everything', async () => {
		const { lines } = await robots('prod');
		expect(lines, `got ${JSON.stringify(lines)}`).toContain('User-agent: *');
		expect(disallowAll(lines), `got ${JSON.stringify(lines)}, want no "Disallow: /"`).toBe(false);
	});

	it('APP_ENV=prod: points at the sitemap on PUBLIC_ORIGIN', async () => {
		const { lines } = await robots('prod');
		expect(sitemaps(lines)).toEqual([`Sitemap: ${PROD_ORIGIN}/sitemap.xml`]);
	});

	for (const appEnv of ['demo', 'prod']) {
		it(`APP_ENV=${appEnv}: answers 200 text/plain`, async () => {
			const { res } = await robots(appEnv);
			expect(res.status, `got ${res.status}, want 200`).toBe(200);
			const type = res.headers.get('content-type') ?? '';
			expect(type, `got content-type ${type}, want text/plain`).toMatch(/^text\/plain\b/);
		});
	}

	it('is not prerendered (APP_ENV is only known at runtime)', async () => {
		vi.resetModules();
		vi.doMock('$app/env/private', () => ({ APP_ENV: 'demo', PUBLIC_ORIGIN: PROD_ORIGIN }));
		const mod = (await import(/* @vite-ignore */ repoFile(ROUTE)).catch(() => ({}))) as {
			prerender?: unknown;
			GET?: unknown;
		};
		expect(mod.GET, `${ROUTE} must export GET`).toBeDefined();
		expect(mod.prerender, `got prerender=${String(mod.prerender)}, want it off`).not.toBe(true);
	});

	// adapter-node serves static/ before the app, so a static robots.txt
	// would shadow the route and make demo indexable.
	it('static/robots.txt does not exist (it would shadow the route)', () => {
		expect(existsSync(repoFile('static/robots.txt')), 'delete static/robots.txt').toBe(false);
	});
});
