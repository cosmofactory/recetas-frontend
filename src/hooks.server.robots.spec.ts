import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExport } from './testutil/load-export';

// FE-8 PR 1 (stage FE-8 -> SEO: "On demo, also send the X-Robots-Tag:
// noindex header from hooks"; coordinates with INF-2). The server `handle`
// adds `X-Robots-Tag: noindex` to EVERY response it resolves when APP_ENV is
// not prod: pages, /robots.txt, /healthz, /readyz, 404s and 500s. With
// APP_ENV=prod the header is absent. Static files (static/, /_app/immutable)
// are served by adapter-node before the hooks run, so they are INF-2's
// (Caddy's) to cover.

type Resolved = { status: number; contentType: string };
type Handle = (input: { event: unknown; resolve: unknown }) => Promise<Response>;

const ORIGIN = 'http://127.0.0.1:4173';

afterEach(() => {
	vi.doUnmock('$app/env/private');
});

async function loadHandle(appEnv: string): Promise<Handle> {
	vi.resetModules();
	vi.doMock('$app/env/private', () => ({ APP_ENV: appEnv, PUBLIC_ORIGIN: ORIGIN }));
	return loadExport<Handle>('src/hooks.server.ts', 'handle');
}

// A request event whose setHeaders lands on the resolved response, as in Kit,
// so the header may be set either way.
function fakeRequest(path: string, resolved: Resolved) {
	const setHeaders = new Headers();
	const event = {
		url: new URL(path, ORIGIN),
		request: new Request(new URL(path, ORIGIN)),
		route: { id: null },
		params: {},
		locals: {},
		setHeaders: (headers: Record<string, string>) => {
			for (const [name, value] of Object.entries(headers)) setHeaders.set(name, value);
		}
	};
	const resolve = async () => {
		const headers = new Headers(setHeaders);
		headers.set('content-type', resolved.contentType);
		return new Response('body', { status: resolved.status, headers });
	};
	return { event, resolve };
}

async function robotsTag(appEnv: string, path: string, resolved: Resolved) {
	const handle = await loadHandle(appEnv);
	const res = await handle(fakeRequest(path, resolved));
	return res.headers.get('x-robots-tag');
}

const HTML = 'text/html; charset=utf-8';
const responses: { name: string; path: string; resolved: Resolved }[] = [
	{ name: 'a page', path: '/en/', resolved: { status: 200, contentType: HTML } },
	{
		name: 'a recipe page',
		path: '/es/dishes/tortilla/gal',
		resolved: { status: 200, contentType: HTML }
	},
	{
		name: '/robots.txt',
		path: '/robots.txt',
		resolved: { status: 200, contentType: 'text/plain; charset=utf-8' }
	},
	{
		name: '/healthz',
		path: '/healthz',
		resolved: { status: 200, contentType: 'application/json' }
	},
	{ name: 'a 404 page', path: '/fr/', resolved: { status: 404, contentType: HTML } },
	{
		name: 'a 503 page',
		path: '/ru/dishes/tortilla',
		resolved: { status: 503, contentType: HTML }
	},
	{ name: 'a 500 page', path: '/en/regions/gal', resolved: { status: 500, contentType: HTML } }
];

describe('handle: X-Robots-Tag', () => {
	for (const appEnv of ['demo', 'local']) {
		for (const { name, path, resolved } of responses) {
			it(`APP_ENV=${appEnv}: ${name} carries X-Robots-Tag: noindex`, async () => {
				const got = await robotsTag(appEnv, path, resolved);
				const directives = (got ?? '').split(',').map((d) => d.trim());
				expect(directives, `got X-Robots-Tag ${JSON.stringify(got)}, want noindex`).toContain(
					'noindex'
				);
			});
		}
	}

	for (const { name, path, resolved } of responses) {
		it(`APP_ENV=prod: ${name} has no X-Robots-Tag`, async () => {
			const got = await robotsTag('prod', path, resolved);
			expect(got, `got X-Robots-Tag ${JSON.stringify(got)}, want none`).toBeNull();
		});
	}

	it('keeps the resolved status and body', async () => {
		const handle = await loadHandle('demo');
		const res = await handle(fakeRequest('/fr/', { status: 404, contentType: HTML }));
		expect(res.status, `got ${res.status}, want 404`).toBe(404);
		expect(await res.text()).toBe('body');
	});
});
