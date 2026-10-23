import { expect, test, type BrowserContext, type Page } from '../testutil/e2e-test';
import { getRaw, LOCALES, localePath, PAGES, setCookieHeaders } from '../testutil/e2e';
import { gotoHydrated, isDesktopPage } from '../testutil/home-e2e';
import { dishCard, quickChip, sidebarChip } from '../testutil/popular-e2e';
import { ingredientRows, moreButton, stepRows } from '../testutil/recipe-e2e';
import { installStorageSpy, recordedWrites } from '../testutil/storage-spy';

// FE-1 acceptance / stack.md X6: no response except /set-lang sets a cookie,
// and no page writes localStorage, sessionStorage, document.cookie or IndexedDB.

// The Popular tab with filters and the mobile dish sheet are home URLs too.
const POPULAR_STATE = '/?tab=popular&f=vegetarian&dish=gazpacho';
const PAGE_URLS = [...PAGES.map((p) => p.path), POPULAR_STATE].flatMap((path) =>
	LOCALES.map((l) => localePath(l, path))
);
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

async function expectNoWrites(page: Page) {
	const writes = await recordedWrites(page);
	expect(writes, `got writes ${JSON.stringify(writes)}, want none`).toEqual([]);
}

async function expectNothingStored(page: Page, context: BrowserContext) {
	await expectNoWrites(page);
	const state = await context.storageState();
	expect(state.cookies, `got cookies ${JSON.stringify(state.cookies)}, want none`).toEqual([]);
	const stored = state.origins.filter((o) => o.localStorage.length > 0);
	expect(stored, `got localStorage ${JSON.stringify(stored)}, want none`).toEqual([]);
}

// A filter chip, then a card: the mobile dish sheet, or the desktop Variations page.
async function usePopular(page: Page) {
	await gotoHydrated(page, '/en/?tab=popular');
	const desktop = isDesktopPage(page);
	const chip = desktop
		? sidebarChip(page, 'en', 'vegetarian')
		: quickChip(page, 'en', 'vegetarian');
	await chip.click();
	await page.waitForURL((url) => url.searchParams.get('f') === 'vegetarian');
	await dishCard(page, 'gazpacho').click();
	await page.waitForURL((url) => /gazpacho/.test(url.pathname + url.search));
}

// The stepper and the ticks, which live in memory only (FE-6).
async function useRecipe(page: Page) {
	await gotoHydrated(page, '/en/dishes/tortilla/gal');
	await moreButton(page, 'en').click();
	await ingredientRows(page).first().click();
	await stepRows(page).first().click();
	await expect(ingredientRows(page).first()).toHaveAttribute('aria-pressed', 'true');
}

test.describe('no client-side storage', () => {
	for (const url of [...PAGE_URLS, '/', '/fr/']) {
		// One locale per engine: the storage APIs don't change with the language.
		const tag = url.startsWith('/en/') || url === '/' ? ['@cross-browser'] : [];
		test(`${url} writes no cookie or storage`, { tag }, async ({ page, context }) => {
			await page.addInitScript(installStorageSpy);
			await page.goto(url, { waitUntil: 'networkidle' });
			await expectNothingStored(page, context);
		});
	}
});

// FE-1 / FE-7 acceptance "no storage writes": using the app stores nothing
// either (the search overlay and the language menu have their own checks).
test.describe('no client-side storage while using the app', () => {
	test('filters, a dish, servings and ticks write no cookie or storage', async ({
		page,
		context
	}) => {
		await page.addInitScript(installStorageSpy);
		await usePopular(page);
		await expectNoWrites(page);
		await useRecipe(page);
		await expectNothingStored(page, context);
	});
});
