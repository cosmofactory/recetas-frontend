import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { headLinks } from '#lib/i18n/head-links.ts';
import { locales } from '#lib/i18n/locales.ts';
import type { CatalogSource, Dish } from '#lib/server/catalog-source.ts';
import bundle from '#lib/server/mock/content.bundle.json';
import { createMockSource } from '#lib/server/mock/mock-source.ts';
import { tortilla } from '../../testutil/catalog';
import { loadExport, repoFile } from '../../testutil/load-export';
import { captureLogLines } from '../../testutil/log-capture';
import {
	MOCK_SITEMAP_URL_COUNT,
	parseSitemap,
	SITEMAP_NS,
	SITEMAP_PATH,
	sortedAlternates,
	XHTML_NS
} from '../../testutil/sitemap';

// FE-8 PR 2 (stage FE-8 -> SEO: "/sitemap.xml generated from the catalog:
// every route in each locale, with xhtml:link hreflang alternates and
// lastmod when the API provides it"; Acceptance: "sitemap.xml lists every
// dish, variation, recipe, and region URL × 3 locales, with alternates, and
// validates against the sitemap schema"). Decisions pinned here:
// - A server route, src/routes/sitemap.xml/+server.ts (`GET`), reading the
//   catalog through `catalog()` (#lib/server/catalog.ts) at request time,
//   never prerendered (the catalog lives behind the runtime API).
// - One <url> per page per locale: /:lang/, /:lang/?tab=popular (its own
//   indexable page, FE-1), /:lang/regions/:key, /:lang/dishes/:key (the
//   Variations page) and /:lang/dishes/:key/:regionKey (the variation's
//   Recipe page). Locale-independent keys, so one list serves all three.
// - <loc> is the page's canonical and the xhtml:link alternates are exactly
//   the page head's (headLinks: en, es, ru and x-default = en, absolute on
//   PUBLIC_ORIGIN). Expected values are computed with headLinks here, the
//   one source the route must share, plus one literal case.
// - No <lastmod>: the API has no updatedAt/lastmod field (schema.d.ts; it
//   only offers ETags), so nothing honest to put there. No changefreq or
//   priority either (Google ignores both).
// - Served whatever APP_ENV is (demo and local too): robots.txt already
//   disallows crawling off prod and handle adds X-Robots-Tag: noindex, so a
//   404 would only add a branch.
// - Content-Type application/xml. The XSD can't be fetched in tests (no
//   network), so the structure is checked element by element against
//   sitemap 0.9's tUrl sequence (testutil/sitemap.ts, testutil/xml.ts).
// - Backend down: 503, like every page (orHttpError).

const ROUTE = 'src/routes/sitemap.xml/+server.ts';
const ORIGIN = 'https://asadorov.es';

type Get = (event: unknown) => Response | Promise<Response>;

type SitemapSpec = { appEnv?: string; source?: CatalogSource };

afterEach(() => {
	vi.doUnmock('$app/env/private');
	vi.doUnmock('#lib/server/catalog.ts');
	vi.restoreAllMocks();
});

function requestEvent() {
	const url = new URL(`${ORIGIN}${SITEMAP_PATH}`);
	return {
		url,
		request: new Request(url),
		params: {},
		locals: {},
		route: { id: SITEMAP_PATH },
		fetch: globalThis.fetch,
		setHeaders: () => {}
	};
}

const mockSource = () => createMockSource(bundle);

async function loadGet({ appEnv = 'prod', source = mockSource() }: SitemapSpec): Promise<Get> {
	vi.resetModules();
	vi.doMock('$app/env/private', () => ({
		APP_ENV: appEnv,
		PUBLIC_ORIGIN: ORIGIN,
		DATA_SOURCE: 'mock',
		BACKEND_API_BASE_URL: undefined
	}));
	vi.doMock('#lib/server/catalog.ts', () => ({ catalog: () => source }));
	return loadExport<Get>(ROUTE, 'GET');
}

async function sitemap(spec: SitemapSpec = {}): Promise<{ res: Response; body: string }> {
	const GET = await loadGet(spec);
	const res = await GET(requestEvent());
	return { res, body: await res.text() };
}

// The status a route answered with, whether it returned a Response or threw
// Kit's error() (an HttpError carrying `status`).
async function statusOf(spec: SitemapSpec): Promise<number> {
	const GET = await loadGet(spec);
	try {
		return (await GET(requestEvent())).status;
	} catch (err) {
		return (err as { status?: number }).status ?? -1;
	}
}

function pagePaths(dishes: Dish[], regionKeys: string[]): string[] {
	return [
		'/',
		'/?tab=popular',
		...regionKeys.map((key) => `/regions/${key}`),
		...dishes.map((dish) => `/dishes/${dish.key}`),
		...dishes.flatMap((dish) => dish.variations.map((v) => `/dishes/${dish.key}/${v.regionKey}`))
	];
}

async function expectedLocs(): Promise<string[]> {
	const source = mockSource();
	const [regions, dishes] = await Promise.all([source.listRegions('en'), source.listDishes('en')]);
	const paths = pagePaths(
		dishes,
		regions.map((region) => region.key)
	);
	return locales.flatMap((lang) => paths.map((path) => `${ORIGIN}/${lang}${path}`)).sort();
}

const alternatesOf = (loc: string) => sortedAlternates(headLinks(ORIGIN, new URL(loc)).alternates);

describe('GET /sitemap.xml: the document', () => {
	it('answers 200 with Content-Type application/xml', async () => {
		const { res } = await sitemap();
		expect(res.status, `got ${res.status}, want 200`).toBe(200);
		const type = res.headers.get('content-type') ?? '';
		expect(type, `got content-type ${type}`).toMatch(/^application\/xml\b/);
	});

	it('is well-formed XML that starts with a UTF-8 declaration', async () => {
		const { body } = await sitemap();
		const { declaration } = parseSitemap(body);
		expect(declaration ?? '', `got declaration ${declaration}`).toMatch(
			/^<\?xml version="1\.0" encoding="UTF-8"\?>$/i
		);
		expect(body.startsWith('<?xml'), 'want nothing before the declaration').toBe(true);
	});

	it('the root is <urlset> in the sitemap namespace, declaring xmlns:xhtml', async () => {
		const { root } = parseSitemap((await sitemap()).body);
		expect(root.name).toBe('urlset');
		expect(root.attrs.xmlns, `got xmlns ${root.attrs.xmlns}`).toBe(SITEMAP_NS);
		expect(root.attrs['xmlns:xhtml'], `got xmlns:xhtml ${root.attrs['xmlns:xhtml']}`).toBe(
			XHTML_NS
		);
	});

	it('<urlset> holds only <url> elements', async () => {
		const { root } = parseSitemap((await sitemap()).body);
		const names = [...new Set(root.children.map((child) => child.name))];
		expect(names).toEqual(['url']);
	});
});

describe('GET /sitemap.xml: the URLs', () => {
	it(`lists (2 + regions + dishes + variations) × 3 = ${MOCK_SITEMAP_URL_COUNT} URLs`, async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		expect(entries.length, `got ${entries.length} <url>`).toBe(MOCK_SITEMAP_URL_COUNT);
		expect((await expectedLocs()).length, 'the fixture count drifted').toBe(MOCK_SITEMAP_URL_COUNT);
	});

	it('every page in every locale, each once, absolute on PUBLIC_ORIGIN', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		const got = entries.map((entry) => entry.loc).sort();
		expect(got).toEqual(await expectedLocs());
	});

	it('every <loc> is that page’s canonical URL', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		for (const { loc } of entries) {
			const canonical = headLinks(ORIGIN, new URL(loc)).canonical;
			expect(loc, `got ${loc}, want its canonical ${canonical}`).toBe(canonical);
		}
	});

	it('includes the Popular tab, its query intact: /es/?tab=popular', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		expect(entries.map((e) => e.loc)).toContain(`${ORIGIN}/es/?tab=popular`);
	});

	it('includes a region, a dish and a variation recipe in ru', async () => {
		const locs = parseSitemap((await sitemap()).body).entries.map((e) => e.loc);
		for (const path of ['/ru/regions/gal', '/ru/dishes/paella', '/ru/dishes/cocido/ast']) {
			expect(locs, `want ${ORIGIN}${path}`).toContain(`${ORIGIN}${path}`);
		}
	});
});

describe('GET /sitemap.xml: each <url>', () => {
	it('is <loc> then the xhtml:link alternates (sitemap 0.9 order), no lastmod', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		for (const { loc, childNames } of entries) {
			const want = ['loc', 'xhtml:link', 'xhtml:link', 'xhtml:link', 'xhtml:link'];
			expect(childNames, `got children ${childNames} in ${loc}`).toEqual(want);
		}
	});

	it('every xhtml:link is rel="alternate"', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		for (const { loc, linkRels } of entries) {
			expect(linkRels, `got rels ${linkRels} in ${loc}`).toEqual(Array(4).fill('alternate'));
		}
	});

	it('the alternates are the page head’s (en, es, ru, x-default)', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		for (const { loc, alternates } of entries) {
			expect(sortedAlternates(alternates), `in ${loc}`).toEqual(alternatesOf(loc));
		}
	});

	it('/es/?tab=popular lists all four alternates with the query', async () => {
		const { entries } = parseSitemap((await sitemap()).body);
		const entry = entries.find((e) => e.loc === `${ORIGIN}/es/?tab=popular`);
		expect(sortedAlternates(entry?.alternates ?? [])).toEqual([
			{ hreflang: 'en', href: `${ORIGIN}/en/?tab=popular` },
			{ hreflang: 'es', href: `${ORIGIN}/es/?tab=popular` },
			{ hreflang: 'ru', href: `${ORIGIN}/ru/?tab=popular` },
			{ hreflang: 'x-default', href: `${ORIGIN}/en/?tab=popular` }
		]);
	});
});

// A catalog whose keys need escaping. The API's slugs never do, but the
// document must stay well-formed whatever the data (escaped or
// percent-encoded, either is valid).
function oddKeySource(): CatalogSource {
	const dish: Dish = {
		...tortilla,
		key: 'a&b',
		variations: tortilla.variations.slice(0, 1).map((v) => ({ ...v, regionKey: 'x<y"z' }))
	};
	return {
		...mockSource(),
		listRegions: async () => [],
		listDishes: async () => [dish]
	};
}

describe('GET /sitemap.xml: escaping', () => {
	it('stays well-formed XML when a key holds &, < or "', async () => {
		const { body } = await sitemap({ source: oddKeySource() });
		const { entries } = parseSitemap(body);
		expect(entries.length, 'want home, Popular, the dish and its variation × 3').toBe(4 * 3);
	});

	it('the raw document has no unescaped & anywhere', async () => {
		const { body } = await sitemap({ source: oddKeySource() });
		expect(body).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i);
	});
});

// The dynamic import runs after loadGet's resetModules, so the error is the
// class the route's orHttpError knows.
function downSource(): CatalogSource {
	const unavailable = async (): Promise<never> => {
		const { UnavailableError } = await import('#lib/server/api-errors.ts');
		throw new UnavailableError('backend down');
	};
	return { ...mockSource(), listRegions: unavailable, listDishes: unavailable };
}

describe('GET /sitemap.xml: environments and failures', () => {
	for (const appEnv of ['demo', 'local', 'prod']) {
		it(`APP_ENV=${appEnv}: is served (robots.txt and noindex keep demo out)`, async () => {
			const { res, body } = await sitemap({ appEnv });
			expect(res.status, `got ${res.status}, want 200`).toBe(200);
			expect(parseSitemap(body).entries.length).toBe(MOCK_SITEMAP_URL_COUNT);
		});
	}

	it('answers 503 when the backend is down', async () => {
		captureLogLines();
		expect(await statusOf({ source: downSource() })).toBe(503);
	});

	it('is not prerendered (the catalog is only known at runtime)', async () => {
		await loadGet({});
		const mod = (await import(/* @vite-ignore */ repoFile(ROUTE)).catch(() => ({}))) as {
			prerender?: unknown;
			GET?: unknown;
		};
		expect(mod.GET, `${ROUTE} must export GET`).toBeDefined();
		expect(mod.prerender, `got prerender=${String(mod.prerender)}, want it off`).not.toBe(true);
	});

	it('static/sitemap.xml does not exist (it would shadow the route)', () => {
		expect(existsSync(repoFile('static/sitemap.xml')), 'delete static/sitemap.xml').toBe(false);
	});
});
