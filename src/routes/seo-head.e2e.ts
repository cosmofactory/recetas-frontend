import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';
import { getRaw, LOCALES, type Locale } from '../testutil/e2e';
import { PUBLIC_ORIGIN } from '../testutil/e2e-origin';
import { metaContents, startTags } from '../testutil/html';

// FE-8 PR 1 (stage FE-8 -> SEO: meta tags; the canonical/hreflang audit),
// read from the server HTML as a crawler or a link-preview bot gets it (no
// JavaScript), so plain HTTP in one project. Titles and descriptions
// themselves are pinned by home-head.e2e.ts and dish-head.e2e.ts; here every
// route type must also carry, once each:
// - og:title = <title>, og:description = meta description;
// - og:url = the canonical URL (pages; error pages have neither);
// - og:type `website`, except `article` on a Recipe page (one recipe is a
//   piece of content; schema.org Recipe JSON-LD arrives in PR 2);
// - og:locale for the page's locale (en_GB: the copy is British English,
//   es_ES, ru_RU) and og:locale:alternate for the other two;
// - og:site_name "Asadorov" (the brand, never translated);
// - og:image: an absolute URL; the mock catalog has no photos and the e2e
//   server no MEDIA_BASE_URL, so here it is the static fallback
//   <PUBLIC_ORIGIN>/og-default.png, which the server must serve (the hero
//   case is in og-image.spec.ts and the page SSR specs);
// - twitter:card `summary_large_image`.
// Canonical audit: query-state URLs (?f, ?dish, any other param) get a
// canonical without the query, except the allow-listed ?tab=popular on the
// home page (FE-1); hreflang is en/es/ru + x-default (= en), absolute on
// PUBLIC_ORIGIN, with the same query rule.

const PROJECT = 'chromium-desktop-1280';
const SITE_NAME = 'Asadorov';
const FALLBACK_IMAGE = `${PUBLIC_ORIGIN}/og-default.png`;
const OG_LOCALE: Record<Locale, string> = { en: 'en_GB', es: 'es_ES', ru: 'ru_RU' };
const HREFLANGS = ['en', 'es', 'ru', 'x-default'];
const X_DEFAULT_LOCALE = 'en';

// extra-strings.json errors.notFoundBody: the 404 page's description.
const NOT_FOUND_BODY: Record<Locale, string> = {
	en: "We couldn't find that page.",
	es: 'No hemos encontrado esa página.',
	ru: 'Мы не нашли эту страницу.'
};

function onlyInHeadProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `head checks run in ${PROJECT} only`);
}

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&#x27;': "'",
	'&lt;': '<',
	'&gt;': '>'
};
const decode = (text: string) => text.replace(/&(amp|quot|#39|#x27|lt|gt);/g, (e) => ENTITIES[e]);

type Head = {
	html: string;
	titles: string[];
	canonicals: string[];
	alternates: { hreflang: string; href: string }[];
	meta: (key: string) => string[];
};

function parseHead(page: string): Head {
	const html = /<head\b[^>]*>([\s\S]*?)<\/head>/.exec(page)?.[1] ?? '';
	const links = startTags(html).filter((t) => t.name === 'link');
	return {
		html,
		titles: [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/g)].map((m) => decode(m[1])),
		canonicals: links.filter((l) => l.attrs.rel === 'canonical').map((l) => decode(l.attrs.href)),
		alternates: links
			.filter((l) => l.attrs.rel === 'alternate' && l.attrs.hreflang !== undefined)
			.map((l) => ({ hreflang: l.attrs.hreflang, href: decode(l.attrs.href) })),
		meta: (key) => metaContents(html, key).map(decode)
	};
}

async function headOf(request: APIRequestContext, url: string, status: number): Promise<Head> {
	const res = await getRaw(request, url);
	expect(res.status(), `got status ${res.status()} for ${url}, want ${status}`).toBe(status);
	return parseHead(await res.text());
}

function only(head: Head, key: string): string {
	const found = head.meta(key);
	expect(found, `got ${key} ${JSON.stringify(found)}, want exactly one`).toHaveLength(1);
	return found[0];
}

function expectSharedTags(head: Head, locale: Locale, type: 'website' | 'article') {
	expect(head.titles, 'want exactly one non-empty <title>').toHaveLength(1);
	expect(head.titles[0].trim()).not.toBe('');
	const description = only(head, 'description');
	expect(description.trim(), 'got an empty meta description').not.toBe('');
	expect(only(head, 'og:title'), 'want og:title = <title>').toBe(head.titles[0]);
	expect(only(head, 'og:description'), 'want og:description = description').toBe(description);
	expect(only(head, 'og:type')).toBe(type);
	expect(only(head, 'og:site_name')).toBe(SITE_NAME);
	expect(only(head, 'og:locale')).toBe(OG_LOCALE[locale]);
	const others = LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]);
	expect(head.meta('og:locale:alternate').sort(), 'want the other two locales').toEqual(others);
	expect(only(head, 'og:image')).toBe(FALLBACK_IMAGE);
	expect(only(head, 'twitter:card')).toBe('summary_large_image');
}

// The canonical (once), og:url = canonical, and the four alternates, all on
// PUBLIC_ORIGIN with `path` (+ `query`) in each locale.
function expectHeadUrls(head: Head, locale: Locale, path: string, query = '') {
	const url = (l: string) => `${PUBLIC_ORIGIN}/${l}${path}${query}`;
	expect(head.canonicals, 'want exactly one canonical').toEqual([url(locale)]);
	expect(only(head, 'og:url'), 'want og:url = the canonical').toBe(url(locale));
	const got = [...head.alternates].sort((a, b) => a.hreflang.localeCompare(b.hreflang));
	const want = HREFLANGS.map((hreflang) => ({
		hreflang,
		href: url(hreflang === 'x-default' ? X_DEFAULT_LOCALE : hreflang)
	}));
	expect(got, `got alternates ${JSON.stringify(got)}`).toEqual(want);
}

type RouteType = { name: string; path: string; query?: string; type: 'website' | 'article' };
const ROUTE_TYPES: RouteType[] = [
	{ name: 'home', path: '/', type: 'website' },
	{ name: 'home Popular', path: '/', query: '?tab=popular', type: 'website' },
	{ name: 'region', path: '/regions/gal', type: 'website' },
	{ name: 'Variations', path: '/dishes/tortilla', type: 'website' },
	{ name: 'Recipe', path: '/dishes/tortilla/gal', type: 'article' }
];

test.describe('meta tags on every page (server-rendered)', () => {
	for (const route of ROUTE_TYPES) {
		for (const locale of LOCALES) {
			const url = `/${locale}${route.path}${route.query ?? ''}`;
			test(`${route.name} ${url}: title, description, og:* and twitter:card`, async ({
				request
			}, testInfo) => {
				onlyInHeadProject(testInfo);
				const head = await headOf(request, url, 200);
				expectSharedTags(head, locale, route.type);
				expectHeadUrls(head, locale, route.path, route.query);
			});
		}
	}
});

test.describe('meta tags on error pages (server-rendered)', () => {
	const errors: { url: string; locale: Locale }[] = [
		...LOCALES.map((locale) => ({ url: `/${locale}/no/such/page`, locale })),
		{ url: `/es/dishes/no-such-dish`, locale: 'es' },
		// No locale in the path: the 404 is in English.
		{ url: '/fr/', locale: 'en' }
	];
	for (const { url, locale } of errors) {
		test(`404 ${url}: localised tags, no canonical, hreflang or og:url`, async ({
			request
		}, testInfo) => {
			onlyInHeadProject(testInfo);
			const head = await headOf(request, url, 404);
			expectSharedTags(head, locale, 'website');
			expect(only(head, 'description')).toBe(NOT_FOUND_BODY[locale]);
			expect(head.canonicals, 'an error page has no canonical').toEqual([]);
			expect(head.alternates, 'an error page has no hreflang').toEqual([]);
			expect(head.meta('og:url'), 'an error page has no og:url').toEqual([]);
		});
	}
});

test.describe('canonical audit: query-state URLs', () => {
	const cases: { url: string; locale: Locale; path: string; query?: string }[] = [
		{
			url: '/es/?tab=popular&f=vegetarian&f=quick',
			locale: 'es',
			path: '/',
			query: '?tab=popular'
		},
		{
			url: '/es/?f=quick&tab=popular&dish=tortilla',
			locale: 'es',
			path: '/',
			query: '?tab=popular'
		},
		{ url: '/ru/?tab=popular&utm_source=x', locale: 'ru', path: '/', query: '?tab=popular' },
		{ url: '/en/?f=quick', locale: 'en', path: '/' },
		{ url: '/en/?dish=tortilla', locale: 'en', path: '/' },
		{ url: '/en/?tab=regional', locale: 'en', path: '/' },
		{ url: '/en/regions/gal?dish=tortilla&f=quick', locale: 'en', path: '/regions/gal' },
		{ url: '/ru/regions/gal?tab=popular', locale: 'ru', path: '/regions/gal' },
		{ url: '/ru/dishes/tortilla?f=quick&tab=popular', locale: 'ru', path: '/dishes/tortilla' },
		{
			url: '/es/dishes/tortilla/gal?dish=x&utm_source=y',
			locale: 'es',
			path: '/dishes/tortilla/gal'
		}
	];
	for (const tc of cases) {
		const want = `/${tc.locale}${tc.path}${tc.query ?? ''}`;
		test(`${tc.url} -> canonical, og:url and alternates on ${want}`, async ({
			request
		}, testInfo) => {
			onlyInHeadProject(testInfo);
			const head = await headOf(request, tc.url, 200);
			expectHeadUrls(head, tc.locale, tc.path, tc.query);
		});
	}
});

test.describe('the fallback OG image', () => {
	test('is served as a PNG by the app', async ({ request }, testInfo) => {
		onlyInHeadProject(testInfo);
		const res = await getRaw(request, new URL(FALLBACK_IMAGE).pathname);
		expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
		expect(res.headers()['content-type']).toBe('image/png');
	});
});
