import { expect, test } from '../testutil/e2e-test';
import { getRaw, LOCALES, localePath, PAGES, setCookieHeaders } from '../testutil/e2e';
import { installStorageSpy, recordedWrites } from '../testutil/storage-spy';

// FE-1 acceptance / stack.md X6: no response except /set-lang sets a cookie,
// and no page writes localStorage, sessionStorage, document.cookie or IndexedDB.

const PAGE_URLS = PAGES.flatMap((p) => LOCALES.map((l) => localePath(l, p.path)));
const OTHER_URLS = [
	'/',
	'/fr/',
	'/xx/dishes/tortilla',
	'/ru/no/such/page/here',
	'/healthz',
	'/set-lang?to=fr'
];

test.describe('no Set-Cookie outside /set-lang', () => {
	for (const url of [...PAGE_URLS, ...OTHER_URLS]) {
		test(`${url} sets no cookie`, async ({ request }) => {
			const res = await getRaw(request, url, { 'accept-language': 'ru', cookie: 'lang=es' });
			const got = setCookieHeaders(res);
			expect(
				got,
				`got Set-Cookie ${JSON.stringify(got)} (status ${res.status()}), want none`
			).toEqual([]);
		});
	}
});

test.describe('no client-side storage', () => {
	for (const url of [...PAGE_URLS, '/', '/fr/']) {
		// One locale per engine: the storage APIs don't change with the language.
		const tag = url.startsWith('/en/') || url === '/' ? ['@cross-browser'] : [];
		test(`${url} writes no cookie or storage`, { tag }, async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await page.goto(url, { waitUntil: 'networkidle' });
			const writes = await recordedWrites(page);
			expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
			const state = await context.storageState();
			expect(state.cookies, `got cookies ${JSON.stringify(state.cookies)}, want none`).toEqual([]);
			const stored = state.origins.filter((o) => o.localStorage.length > 0);
			expect(stored, `got localStorage ${JSON.stringify(stored)}, want none`).toEqual([]);
		});
	}
});
