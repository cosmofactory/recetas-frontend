import { expect, test } from '@playwright/test';
import { getRaw, LOCALES, localePath, PAGES, setCookieHeaders } from '../testutil/e2e';

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

// Records every storage/cookie write before any app code runs.
function installStorageSpy() {
	const writes: string[] = [];
	(window as unknown as { __writes: string[] }).__writes = writes;
	for (const method of ['setItem', 'removeItem', 'clear'] as const) {
		const original = Storage.prototype[method];
		Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
			writes.push(`Storage.${method}(${JSON.stringify(args)})`);
			return (original as (...a: unknown[]) => unknown).apply(this, args);
		} as never;
	}
	const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
	Object.defineProperty(Document.prototype, 'cookie', {
		configurable: true,
		get: cookie.get,
		set(value: string) {
			writes.push(`document.cookie = ${value}`);
			cookie.set!.call(this, value);
		}
	});
	const open = IDBFactory.prototype.open;
	IDBFactory.prototype.open = function (this: IDBFactory, ...args: Parameters<typeof open>) {
		writes.push(`indexedDB.open(${String(args[0])})`);
		return open.apply(this, args);
	};
}

test.describe('no client-side storage', () => {
	for (const url of [...PAGE_URLS, '/', '/fr/']) {
		// One locale per engine: the storage APIs don't change with the language.
		const tag = url.startsWith('/en/') || url === '/' ? ['@cross-browser'] : [];
		test(`${url} writes no cookie or storage`, { tag }, async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await page.goto(url, { waitUntil: 'networkidle' });
			const writes = await page.evaluate(
				() => (window as unknown as { __writes: string[] }).__writes
			);
			expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
			const state = await context.storageState();
			expect(state.cookies, `got cookies ${JSON.stringify(state.cookies)}, want none`).toEqual([]);
			const stored = state.origins.filter((o) => o.localStorage.length > 0);
			expect(stored, `got localStorage ${JSON.stringify(stored)}, want none`).toEqual([]);
		});
	}
});
