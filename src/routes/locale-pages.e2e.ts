import { expect, test, type Page } from '@playwright/test';
import { getRaw, htmlLang, LOCALES, localePath, PAGES, type Locale } from '../testutil/e2e';
import { PUBLIC_ORIGIN } from '../testutil/e2e-origin';

// FE-1 acceptance: every page lives under /:lang/, the URL alone decides the
// language, the head carries canonical + hreflang, and unknown prefixes get a
// localised 404.

type HeadLinks = { canonical: string[]; alternates: { hreflang: string; href: string }[] };

function readHeadLinks(page: Page): Promise<HeadLinks> {
	return page.evaluate(() => ({
		canonical: [...document.head.querySelectorAll('link[rel="canonical"]')].map(
			(l) => l.getAttribute('href') ?? ''
		),
		alternates: [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
			hreflang: l.getAttribute('hreflang') ?? '',
			href: l.getAttribute('href') ?? ''
		}))
	}));
}

// Head URLs are PUBLIC_ORIGIN + the localised path, exactly.
function expectHeadUrl(href: string, wantPath: string, label: string) {
	const want = `${PUBLIC_ORIGIN}${wantPath}`;
	expect(href, `got ${label} ${href}, want ${want}`).toBe(want);
}

// <link rel="canonical"> and <link rel="alternate" hreflang> hrefs in raw HTML.
function headHrefs(html: string): string[] {
	const links = html.match(/<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*>/g) ?? [];
	return links.map((l) => /\bhref="([^"]*)"/.exec(l)?.[1] ?? '');
}

test.describe('stub pages', () => {
	for (const p of PAGES) {
		for (const locale of LOCALES) {
			const url = localePath(locale, p.path);
			test(`${url} renders server-side in ${locale}`, async ({ request }) => {
				const res = await getRaw(request, url);
				expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
				const html = await res.text();
				const lang = htmlLang(html);
				expect(lang, `got <html lang="${lang}">, want ${locale}`).toBe(locale);
				expect(html, `got no <h1> "${p.h1[locale]}" in the HTML`).toMatch(
					new RegExp(`<h1[^>]*>\\s*${p.h1[locale]}\\s*</h1>`)
				);
			});
		}
	}
});

test.describe('the URL wins over cookie and Accept-Language', () => {
	for (const p of PAGES) {
		const url = localePath('ru', p.path);
		test(`${url} stays Russian with lang=es and Accept-Language es`, async ({ request }) => {
			const res = await getRaw(request, url, { cookie: 'lang=es', 'accept-language': 'es-ES,es' });
			expect(res.status(), `got status ${res.status()}, want 200 (no redirect)`).toBe(200);
			const html = await res.text();
			expect(htmlLang(html), 'got the wrong <html lang>, want ru').toBe('ru');
			expect(html, `got no Russian <h1> ${p.h1.ru}`).toContain(p.h1.ru);
		});
	}

	test('a browser with lang=es renders /ru/dishes/tortilla in Russian', async ({
		page,
		baseURL
	}) => {
		await page.context().addCookies([{ name: 'lang', value: 'es', url: baseURL! }]);
		await page.goto('/ru/dishes/tortilla');
		expect(new URL(page.url()).pathname).toBe('/ru/dishes/tortilla');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
		await expect(page.locator('h1')).toHaveText(PAGES[2].h1.ru);
	});
});

test.describe('head tags (server-rendered)', () => {
	test.use({ javaScriptEnabled: false });

	for (const p of PAGES) {
		for (const locale of LOCALES) {
			const url = localePath(locale, p.path);
			test(`${url} has a canonical URL and en/es/ru + x-default alternates`, async ({ page }) => {
				await page.goto(url);
				const head = await readHeadLinks(page);
				expect(head.canonical.length, `got canonicals ${JSON.stringify(head.canonical)}`).toBe(1);
				expectHeadUrl(head.canonical[0], url, 'canonical');
				const langs = head.alternates.map((a) => a.hreflang).sort();
				expect(langs, `got hreflangs ${JSON.stringify(langs)}`).toEqual([
					'en',
					'es',
					'ru',
					'x-default'
				]);
				for (const a of head.alternates) {
					const target = a.hreflang === 'x-default' ? 'en' : a.hreflang;
					expectHeadUrl(a.href, localePath(target, p.path), `hreflang=${a.hreflang}`);
				}
			});
		}
	}
});

// Only indexable query params survive in head URLs: `tab=popular` on the home
// page (regional is the default, so it has no param). Anything else is dropped.
test.describe('head URLs and query params', () => {
	test.use({ javaScriptEnabled: false });

	const cases: { url: string; want: string }[] = [
		{ url: '/es/?tab=popular', want: '/?tab=popular' },
		{ url: '/es/?tab=popular&utm=x', want: '/?tab=popular' },
		{ url: '/es/?utm=x&tab=popular', want: '/?tab=popular' },
		{ url: '/es/?tab=bogus', want: '/' },
		{ url: '/es/?tab=regional', want: '/' },
		{ url: '/es/?utm=x', want: '/' },
		{ url: '/ru/dishes/tortilla?tab=popular', want: '/dishes/tortilla' }
	];
	for (const tc of cases) {
		test(`${tc.url} -> canonical and alternates on ${tc.want}`, async ({ page }) => {
			await page.goto(tc.url);
			const head = await readHeadLinks(page);
			const locale = tc.url.split('/')[1];
			expect(head.canonical, `got canonicals ${JSON.stringify(head.canonical)}`).toEqual([
				`${PUBLIC_ORIGIN}${localePath(locale, tc.want)}`
			]);
			for (const a of head.alternates) {
				const target = a.hreflang === 'x-default' ? 'en' : a.hreflang;
				const want = `${PUBLIC_ORIGIN}${localePath(target, tc.want)}`;
				expect(a.href, `got hreflang=${a.hreflang} ${a.href}, want ${want}`).toBe(want);
			}
			expect(head.alternates.length, 'got the wrong number of alternates').toBe(4);
		});
	}
});

test.describe('head URLs ignore the request host', () => {
	const spoofed: { name: string; headers: Record<string, string> }[] = [
		{ name: 'a foreign Host header', headers: { host: 'evil.example' } },
		{ name: 'X-Forwarded-Host', headers: { 'x-forwarded-host': 'evil.example' } },
		{ name: 'X-Forwarded-Proto https', headers: { 'x-forwarded-proto': 'https' } }
	];
	for (const tc of spoofed) {
		test(`/ru/dishes/tortilla with ${tc.name} still uses PUBLIC_ORIGIN`, async ({ request }) => {
			const res = await getRaw(request, '/ru/dishes/tortilla', tc.headers);
			expect(res.status(), `got status ${res.status()}, want 200`).toBe(200);
			const hrefs = headHrefs(await res.text());
			expect(hrefs.length, `got head links ${JSON.stringify(hrefs)}, want 5`).toBe(5);
			const foreign = hrefs.filter((h) => !h.startsWith(`${PUBLIC_ORIGIN}/`));
			expect(foreign, `got ${JSON.stringify(foreign)}, want all under ${PUBLIC_ORIGIN}`).toEqual(
				[]
			);
		});
	}
});

// 404 pages: a valid locale prefix renders the error in that locale; anything
// else has no locale in the path and falls back to en.
test.describe('localised 404', () => {
	async function notFound(page: Page, url: string): Promise<{ lang: string; h1: string }> {
		const res = await page.goto(url);
		expect(res?.status(), `got status ${res?.status()} for ${url}, want 404`).toBe(404);
		const h1 = page.locator('h1');
		await expect(h1, `got no visible <h1> on ${url}`).toBeVisible();
		return {
			lang: (await page.locator('html').getAttribute('lang')) ?? '',
			h1: await h1.innerText()
		};
	}

	const missing = (locale: Locale) => localePath(locale, '/no/such/page/here');

	for (const url of ['/fr/', '/xx/dishes/tortilla', '/EN/', '/en-us/']) {
		test(`${url} is a 404 in English`, async ({ page }) => {
			const got = await notFound(page, url);
			const want = await notFound(page, missing('en'));
			expect(got.lang, `got lang ${got.lang}, want en`).toBe('en');
			expect(got.h1, `got "${got.h1}", want the English 404 "${want.h1}"`).toBe(want.h1);
		});
	}

	for (const locale of ['es', 'ru'] as const) {
		test(`an unknown page under /${locale}/ is a 404 in that language`, async ({ page }) => {
			const got = await notFound(page, missing(locale));
			const en = await notFound(page, missing('en'));
			expect(got.lang, `got lang ${got.lang}, want ${locale}`).toBe(locale);
			expect(got.h1.trim(), 'got an empty 404 heading').not.toBe('');
			expect(got.h1, `got the English 404 text "${got.h1}" in ${locale}`).not.toBe(en.h1);
		});
	}

	test('the Russian 404 heading is in Cyrillic', async ({ page }) => {
		const got = await notFound(page, missing('ru'));
		expect(got.h1, `got "${got.h1}", want Cyrillic text`).toMatch(/[Ѐ-ӿ]/);
	});

	test('the visible Spanish 404 shows no English default message', async ({ page }) => {
		await notFound(page, missing('es'));
		const text = await page.locator('body').innerText();
		expect(text, `got "${text}", want no "Not Found"`).not.toMatch(/Not Found/i);
	});
});

test.describe('smoke in every locale', () => {
	for (const locale of LOCALES) {
		test(`/${locale}/ renders its heading without horizontal scroll`, async ({ page }) => {
			const res = await page.goto(`/${locale}/`);
			expect(res?.status(), `got status ${res?.status()}, want 200`).toBe(200);
			await expect(page.locator('html')).toHaveAttribute('lang', locale);
			await expect(page.locator('h1')).toHaveText(PAGES[0].h1[locale]);
			await expect(page.getByTestId('app-shell')).toHaveCount(1);
			const m = await page.evaluate(() => ({
				scroll: document.documentElement.scrollWidth,
				inner: window.innerWidth
			}));
			expect(m.scroll, `got scrollWidth ${m.scroll}, want <= ${m.inner}`).toBeLessThanOrEqual(
				m.inner
			);
		});
	}
});
