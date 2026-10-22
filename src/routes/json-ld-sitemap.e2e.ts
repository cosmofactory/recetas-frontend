import { expect, test, type APIRequestContext, type TestInfo } from '../testutil/e2e-test';
import { getRaw, LOCALES, PAGES, type Locale } from '../testutil/e2e';
import { PUBLIC_ORIGIN } from '../testutil/e2e-origin';
import { decodeAmp, startTags } from '../testutil/html';
import { breadcrumbItems, jsonLdDocuments, onlyNodeOfType } from '../testutil/json-ld';
import { MOCK_SITEMAP_URL_COUNT, parseSitemap, SITEMAP_PATH } from '../testutil/sitemap';

// FE-8 PR 2, against the real server (node build, DATA_SOURCE=mock,
// APP_ENV=demo), read over plain HTTP as a crawler gets it (no JavaScript),
// so in one project. Pinned here:
// - /sitemap.xml is served on demo too (robots.txt disallows it there; the
//   route spec covers the structure), lists every page × 3 locales on
//   PUBLIC_ORIGIN, and every listed URL answers 200 with itself as the
//   canonical (no 404s or redirects in the sitemap).
// - The Recipe and Variations pages' JSON-LD is in the <head>, parses, and
//   names schema.org in en/es/ru; the Recipe's url is the page's canonical,
//   and both pages' breadcrumb trails end at the page's canonical.

const PROJECT = 'chromium-desktop-1280';
const SITEMAP_CRAWL_TIMEOUT_MS = 120_000;
const RECIPE_PATH = '/dishes/tortilla/gal';
const VARIATIONS_PATH = '/dishes/tortilla';
const TORTILLA_VARIATION_COUNT = 13;

function onlyInProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `server checks run in ${PROJECT} only`);
}

const headOf = (page: string) => /<head\b[^>]*>([\s\S]*?)<\/head>/.exec(page)?.[1] ?? '';

function canonicalsIn(head: string): string[] {
	return startTags(head)
		.filter((t) => t.name === 'link' && t.attrs.rel === 'canonical')
		.map((t) => decodeAmp(t.attrs.href ?? ''));
}

async function fetchHead(request: APIRequestContext, url: string): Promise<string> {
	const res = await getRaw(request, url);
	expect(res.status(), `got ${res.status()} for ${url}, want 200`).toBe(200);
	return headOf(await res.text());
}

function onlyCanonical(head: string, url: string): string {
	const found = canonicalsIn(head);
	expect(found, `want one canonical on ${url}`).toHaveLength(1);
	return found[0];
}

const recipeName = (lang: Locale) => PAGES.find((p) => p.name === 'recipe')!.text[lang];

test.describe('/sitemap.xml', () => {
	test('is served as XML with every page × 3 locales on PUBLIC_ORIGIN', async ({
		request
	}, testInfo) => {
		onlyInProject(testInfo);
		const res = await getRaw(request, SITEMAP_PATH);
		expect(res.status(), `got ${res.status()}, want 200`).toBe(200);
		expect(res.headers()['content-type'] ?? '').toMatch(/^application\/xml\b/);
		const { entries } = parseSitemap(await res.text());
		expect(entries.length).toBe(MOCK_SITEMAP_URL_COUNT);
		for (const { loc } of entries) expect(loc.startsWith(`${PUBLIC_ORIGIN}/`), loc).toBe(true);
	});

	test('every listed URL answers 200 with itself as the canonical', async ({
		request
	}, testInfo) => {
		onlyInProject(testInfo);
		test.setTimeout(SITEMAP_CRAWL_TIMEOUT_MS);
		const { entries } = parseSitemap(await (await getRaw(request, SITEMAP_PATH)).text());
		expect(entries.length, 'got an empty sitemap').toBe(MOCK_SITEMAP_URL_COUNT);
		for (const { loc } of entries) {
			const path = loc.slice(PUBLIC_ORIGIN.length);
			expect(onlyCanonical(await fetchHead(request, path), path), path).toBe(loc);
		}
	});
});

test.describe('JSON-LD (server-rendered)', () => {
	for (const lang of LOCALES) {
		test(`${lang}: the Recipe page's JSON-LD parses; its url is the canonical`, async ({
			request
		}, testInfo) => {
			onlyInProject(testInfo);
			const url = `/${lang}${RECIPE_PATH}`;
			const head = await fetchHead(request, url);
			const recipe = onlyNodeOfType(head, 'Recipe');
			expect(recipe.url, 'want the Recipe url = the canonical').toBe(onlyCanonical(head, url));
			expect([recipe.name, recipe.inLanguage]).toEqual([recipeName(lang), lang]);
			const crumbs = breadcrumbItems(onlyNodeOfType(head, 'BreadcrumbList'));
			expect(crumbs.at(-1)?.item, 'want the trail to end here').toBe(onlyCanonical(head, url));
		});

		test(`${lang}: the Variations page's ItemList and BreadcrumbList parse`, async ({
			request
		}, testInfo) => {
			onlyInProject(testInfo);
			const url = `/${lang}${VARIATIONS_PATH}`;
			const head = await fetchHead(request, url);
			for (const doc of jsonLdDocuments(head)) expect(doc['@context']).toBe('https://schema.org');
			const items = onlyNodeOfType(head, 'ItemList').itemListElement as { url: string }[];
			expect(items.length).toBe(TORTILLA_VARIATION_COUNT);
			expect(items[0].url).toBe(`${PUBLIC_ORIGIN}/${lang}${RECIPE_PATH}`);
			const crumbs = breadcrumbItems(onlyNodeOfType(head, 'BreadcrumbList'));
			expect(crumbs.at(-1)?.item, 'want the trail to end here').toBe(onlyCanonical(head, url));
		});
	}
});
