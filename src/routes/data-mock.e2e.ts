import { expect, test, type TestInfo } from '../testutil/e2e-test';
import { getRaw, htmlLang } from '../testutil/e2e';

// FE-2 acceptance with DATA_SOURCE=mock (set on the Playwright webServer):
// pages render real names from the vendored bundle, server-side, in the URL's
// language; unknown keys give the localised 404 page. Data loading does not
// depend on the viewport, so this runs in one project only.

const PROJECT = 'chromium-mobile-390';

function onlyInOneProject(testInfo: TestInfo) {
	test.skip(testInfo.project.name !== PROJECT, `data checks run in ${PROJECT} only`);
}

const pages = [
	{ url: '/ru/regions/gal', lang: 'ru', text: 'Галисия', what: 'the Russian region name' },
	{ url: '/es/regions/bas', lang: 'es', text: 'País Vasco', what: 'the Spanish region name' },
	{ url: '/es/dishes/tortilla', lang: 'es', text: 'Tortilla de patatas', what: 'the dish name' },
	{ url: '/ru/dishes/tortilla', lang: 'ru', text: 'Тортилья', what: 'the Russian dish name' },
	{
		url: '/en/dishes/tortilla/gal',
		lang: 'en',
		text: 'Betanzos-style runny',
		what: 'the variation name'
	}
];

const missing = [
	{ url: '/en/dishes/nope', title: 'Page not found' },
	{ url: '/ru/regions/nope', title: 'Страница не найдена' },
	{ url: '/es/dishes/tortilla/nope', title: 'Página no encontrada' },
	{ url: '/en/dishes/paella/gal', title: 'Page not found' }
];

test.describe('mock data source', () => {
	for (const p of pages) {
		test(`${p.url} renders ${p.what} server-side`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, p.url);
			expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
			const html = await res.text();
			expect(htmlLang(html)).toBe(p.lang);
			expect(html, `got no "${p.text}" in the HTML`).toContain(p.text);
		});
	}

	for (const m of missing) {
		test(`${m.url} is a localised 404`, async ({ request }, testInfo) => {
			onlyInOneProject(testInfo);
			const res = await getRaw(request, m.url);
			expect(res.status(), `got status ${res.status()}, want 404`).toBe(404);
			const html = await res.text();
			expect(html, `got no "${m.title}" in the 404 page`).toContain(m.title);
		});
	}
});
