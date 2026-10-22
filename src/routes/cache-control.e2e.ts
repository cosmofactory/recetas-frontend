import { expect, test, type APIResponse, type TestInfo } from '../testutil/e2e-test';
import { getRaw, headerTokens } from '../testutil/e2e';

// FE-8 PR 3, Performance: HTTP caching, against the production server
// (adapter-node). Stage FE-8 -> Performance: "immutable for hashed assets.
// SSR HTML gets Cache-Control: public, max-age=60, stale-while-revalidate=600
// (adjust in INF-5 if Caddy caches)". Plain HTTP, so one project.
//
// Decisions pinned here (FE-8 PR 3):
// - Every 200 SSR page, in every locale and with query state (?tab, ?f,
//   ?dish): exactly `public, max-age=60, stale-while-revalidate=600`. The
//   URL path alone decides the language (stack.md X6), so a page varies on
//   neither Cookie nor Accept-Language (no such Vary, no `Vary: *`).
// - The bare `/` redirect depends on the `lang` cookie and Accept-Language:
//   `private, no-store`, `Vary: Accept-Language, Cookie` (already so; guard).
// - `/set-lang` writes the cookie: `no-store`, never public.
// - Error pages (404 here; the 503 in error-pages-prod.e2e.ts): `no-store`,
//   never public, so a shared cache can't pin an outage or a not-yet-added
//   dish.
// - `/healthz`, `/readyz`: `no-store` (guard).
// - `/sitemap.xml`, `/robots.txt`: exactly `public, max-age=3600`; they
//   change only with a catalog import or a deploy, and an hour is short for
//   crawlers.
// - `__data.json` (client navigation): the same data as its page, so either
//   the page's policy (e.g. set through a load's setHeaders, which Kit
//   applies to both) or Kit's default `private, no-store`; never anything
//   longer-lived or shared otherwise.
// - Hashed `/_app/immutable/*`: `public, max-age=31536000, immutable`
//   (adapter-node's sirv; guard).

const PROJECT = 'chromium-desktop-1280';

const PAGE_POLICY = ['max-age=60', 'public', 'stale-while-revalidate=600'];
const NO_STORE = 'no-store';
const SHORT_PUBLIC = ['max-age=3600', 'public'];
const KIT_DATA_DEFAULT = ['no-store', 'private'];
const IMMUTABLE = ['immutable', 'max-age=31536000', 'public'];

const PAGES = [
	'/en/',
	'/es/',
	'/ru/',
	'/en/?tab=popular',
	'/es/?tab=popular&f=vegetarian&f=quick',
	'/en/?tab=popular&dish=tortilla',
	'/ru/regions/gal',
	'/en/dishes/tortilla',
	'/es/dishes/tortilla/gal',
	'/ru/dishes/tortilla/gal'
];

const ERROR_PAGES = ['/fr/', '/en/dishes/no-such-dish', '/es/no/such/page'];

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `HTTP checks run in ${PROJECT} only`);
}

const cacheControl = (res: APIResponse) => headerTokens(res, 'cache-control').sort();

function expectPolicy(res: APIResponse, want: string[]) {
	const got = cacheControl(res);
	expect(got, `got Cache-Control ${JSON.stringify(got)} on ${res.url()}, want ${want}`).toEqual(
		want
	);
}

function expectNotStored(res: APIResponse) {
	const got = cacheControl(res);
	const what = `Cache-Control ${JSON.stringify(got)} on ${res.url()} (${res.status()})`;
	expect(got, `got ${what}, want no-store`).toContain(NO_STORE);
	expect(got, `got ${what}, want it never public`).not.toContain('public');
}

test.describe('Cache-Control: SSR pages', () => {
	for (const url of PAGES) {
		test(`${url}: public, max-age=60, stale-while-revalidate=600`, async ({
			request
		}, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
			expectPolicy(res, PAGE_POLICY);
		});

		test(`${url}: varies on neither Cookie nor Accept-Language`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const vary = headerTokens(await getRaw(request, url), 'vary');
			for (const banned of ['cookie', 'accept-language', '*']) {
				expect(vary, `got Vary ${JSON.stringify(vary)}, want no ${banned}`).not.toContain(banned);
			}
		});
	}
});

test.describe('Cache-Control: exceptions', () => {
	test('/ (the locale redirect): private, no-store, Vary Accept-Language and Cookie', async ({
		request
	}, testInfo) => {
		onlyInOneProject(testInfo);
		const res = await getRaw(request, '/', { cookie: 'lang=es' });
		expect(res.status(), `got ${res.status()}, want 302`).toBe(302);
		expectPolicy(res, ['no-store', 'private']);
		const vary = headerTokens(res, 'vary');
		for (const want of ['accept-language', 'cookie']) {
			expect(vary, `got Vary ${JSON.stringify(vary)}, want ${want}`).toContain(want);
		}
	});

	for (const url of ['/set-lang?to=es&next=%2Fes%2F', '/set-lang?to=fr']) {
		test(`${url}: no-store`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			expectNotStored(await getRaw(request, url));
		});
	}

	for (const url of ERROR_PAGES) {
		test(`${url} (404): no-store`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want 404`).toBe(404);
			expectNotStored(res);
		});
	}

	for (const url of ['/healthz', '/readyz']) {
		test(`${url}: no-store`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			expectNotStored(await getRaw(request, url));
		});
	}

	for (const url of ['/sitemap.xml', '/robots.txt']) {
		test(`${url}: public, max-age=3600`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
			expectPolicy(res, SHORT_PUBLIC);
		});
	}

	for (const url of ['/en/__data.json', '/es/dishes/tortilla/__data.json']) {
		test(`${url}: the page's policy or Kit's private, no-store`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, url);
			expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
			const got = cacheControl(res);
			expect(
				[PAGE_POLICY, KIT_DATA_DEFAULT].map((p) => p.join()),
				`got Cache-Control ${JSON.stringify(got)}, want ${PAGE_POLICY} or ${KIT_DATA_DEFAULT}`
			).toContain(got.join());
		});
	}
});

test.describe('Cache-Control: hashed assets', () => {
	test('/_app/immutable/* is public, max-age=31536000, immutable', async ({
		request
	}, testInfo) => {
		onlyInOneProject(testInfo);
		const html = await (await getRaw(request, '/en/')).text();
		const assets = [...new Set(html.match(/\/_app\/immutable\/[^"'\s)]+/g) ?? [])];
		expect(assets.length, 'want hashed assets linked from the page').toBeGreaterThan(0);
		for (const asset of assets.slice(0, 5)) {
			const res = await getRaw(request, asset);
			expect(res.status(), `got ${res.status()} for ${asset}, want 200`).toBe(200);
			expectPolicy(res, IMMUTABLE);
		}
	});
});
