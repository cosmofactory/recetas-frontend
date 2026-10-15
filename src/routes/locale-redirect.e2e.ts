import { expect, test } from '@playwright/test';
import { getRaw, headerTokens, redirectTarget, setCookieHeaders } from '../testutil/e2e';

// FE-1 acceptance: a bare `/` redirects (302) by the `lang` cookie, then
// Accept-Language (es/ru), then en; never cached, never sets a cookie.

const cases: { name: string; headers: Record<string, string>; want: string }[] = [
	{
		name: 'Accept-Language ru-RU,ru;q=0.9',
		headers: { 'accept-language': 'ru-RU,ru;q=0.9' },
		want: '/ru/'
	},
	{ name: 'Accept-Language de-DE', headers: { 'accept-language': 'de-DE' }, want: '/en/' },
	{
		name: 'Accept-Language es-ES,es;q=0.9',
		headers: { 'accept-language': 'es-ES,es;q=0.9' },
		want: '/es/'
	},
	{ name: 'no Accept-Language', headers: {}, want: '/en/' },
	{
		name: 'cookie lang=es with Accept-Language ru',
		headers: { cookie: 'lang=es', 'accept-language': 'ru' },
		want: '/es/'
	},
	{
		name: 'cookie lang=en with Accept-Language ru',
		headers: { cookie: 'lang=en', 'accept-language': 'ru' },
		want: '/en/'
	},
	{
		name: 'invalid cookie lang=xx with Accept-Language ru',
		headers: { cookie: 'lang=xx', 'accept-language': 'ru' },
		want: '/ru/'
	},
	{
		name: 'invalid cookie lang=xx and no Accept-Language',
		headers: { cookie: 'lang=xx' },
		want: '/en/'
	},
	{
		name: 'an unrelated cookie only',
		headers: { cookie: 'other=ru', 'accept-language': 'es' },
		want: '/es/'
	}
];

test.describe('GET /', () => {
	for (const tc of cases) {
		test(`${tc.name} redirects 302 to ${tc.want}`, async ({ request, baseURL }) => {
			const res = await getRaw(request, '/', tc.headers);
			expect(res.status(), `got status ${res.status()}, want 302`).toBe(302);
			const got = redirectTarget(res, baseURL!);
			expect(got, `got Location ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}

	test('varies on Accept-Language and Cookie', async ({ request }) => {
		const vary = headerTokens(await getRaw(request, '/'), 'vary');
		for (const want of ['accept-language', 'cookie']) {
			expect(vary, `got Vary ${JSON.stringify(vary)}, want it to include ${want}`).toContain(want);
		}
	});

	test('is private and never stored', async ({ request }) => {
		const cache = headerTokens(await getRaw(request, '/'), 'cache-control');
		for (const want of ['private', 'no-store']) {
			expect(cache, `got Cache-Control ${JSON.stringify(cache)}, want ${want}`).toContain(want);
		}
	});

	test('does not set a cookie, even when one steered the redirect', async ({ request }) => {
		const res = await getRaw(request, '/', { cookie: 'lang=es' });
		const got = setCookieHeaders(res);
		expect(got, `got Set-Cookie ${JSON.stringify(got)}, want none`).toEqual([]);
	});
});

test.describe('a browser with a Russian UI language', () => {
	test.use({ locale: 'ru-RU' });

	test('lands on the Russian home page from /', async ({ page }) => {
		const res = await page.goto('/');
		expect(res?.status(), `got status ${res?.status()}, want 200`).toBe(200);
		expect(new URL(page.url()).pathname, `got ${page.url()}, want /ru/`).toBe('/ru/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	});
});
