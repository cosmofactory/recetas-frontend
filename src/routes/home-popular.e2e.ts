import { expect, test, type Page } from '@playwright/test';
import { LOCALES } from '../testutil/e2e';
import {
	boxOf,
	expectSameDocument,
	gotoHydrated,
	isDesktopPage,
	markDocument,
	pathAndQuery
} from '../testutil/home-e2e';
import {
	DISH_KEYS,
	DISH_NAMES,
	POPULAR_COPY,
	QUICK_IDS,
	type PopularLocale
} from '../testutil/popular-copy';
import {
	dishCards,
	expectDishes,
	expectFiltersButton,
	filterBar,
	filtersButton,
	noMatch,
	popularPanel,
	pressedChips,
	quickChip,
	listScroller,
	resultCount,
	scrollListToEnd,
	skipOnDesktop
} from '../testutil/popular-e2e';
import { historyLength } from '../testutil/region-e2e';

// FE-5 PR 1, the mobile Popular tab end to end (stage FE-5 -> Filter bar,
// Result list, Acceptance). The filters live in the URL (D-FE5-1: repeated
// `f` params, canonical order), which is the single source of truth: a chip
// press navigates, the list follows the URL, a reload restores it and the
// same URL in another locale shows the same dishes.
//
// Sources: mobile README -> Popular tab — body L81–93; Filters sheet L110
// ("OR within a group, AND across groups"); stage FE-5 -> Empty state
// (desktop.noMatch + "Clear all", on mobile too) and Preparation (the list
// scrolls in its own container; the body never scrolls on mobile home; the
// Popular panel has its own heading).
//
// Decisions pinned here (FE-5 PR 1): a chip press is a client-side
// navigation to toggleFilterHref (same document); "Clear all" goes to
// /:lang/?tab=popular. Card hrefs are /:lang/?tab=popular[&f=…]&dish=<key>.

const VEGETARIAN_DISHES = ['tortilla', 'gazpacho', 'arrozleche'];

async function openPopular(page: Page, lang: PopularLocale, query = '') {
	await gotoHydrated(page, `/${lang}/?tab=popular${query}`);
}

async function press(page: Page, lang: PopularLocale, id: (typeof QUICK_IDS)[number]) {
	await quickChip(page, lang, id).click();
}

async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

test.describe('Popular (mobile): the unfiltered list', () => {
	for (const lang of LOCALES) {
		test(`${lang}: every dish in dish order, "${POPULAR_COPY[lang].dishes[7]}", nothing active`, async ({
			page
		}) => {
			skipOnDesktop(page);
			await openPopular(page, lang);
			await expectDishes(page, DISH_KEYS, 'unfiltered');
			await expect(resultCount(page)).toHaveText(POPULAR_COPY[lang].dishes[7]);
			await expectFiltersButton(page, lang, 0);
			expect(await pressedChips(page, lang, QUICK_IDS)).toEqual([]);
			await expect(noMatch(page)).toHaveCount(0);
		});

		test(`${lang}: the cards show the localized dish names`, async ({ page }) => {
			skipOnDesktop(page);
			await openPopular(page, lang);
			const names = DISH_KEYS.map((key) => DISH_NAMES[lang][key]);
			await expect(dishCards(page).locator('h3')).toHaveText(names);
		});
	}

	test('no sort control on the tab', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en');
		const sort = page
			.locator('select, [role="combobox"], [role="listbox"]')
			.filter({ visible: true });
		await expect(sort).toHaveCount(0);
	});

	test('each card links to its dish sheet URL, keeping the filters', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en', '&f=vegetarian');
		await expect(dishCards(page).first()).toHaveAttribute(
			'href',
			'/en/?tab=popular&f=vegetarian&dish=tortilla'
		);
	});
});

test.describe('Popular (mobile): quick chips drive the URL', () => {
	for (const lang of LOCALES) {
		test(`${lang}: Vegetarian on writes f=vegetarian and filters the list, no reload`, async ({
			page
		}) => {
			skipOnDesktop(page);
			await openPopular(page, lang);
			await markDocument(page);
			await press(page, lang, 'vegetarian');
			await expectUrl(page, `/${lang}/?tab=popular&f=vegetarian`);
			await expectDishes(page, VEGETARIAN_DISHES, 'vegetarian');
			await expect(resultCount(page)).toHaveText(POPULAR_COPY[lang].dishes[3]);
			await expect(quickChip(page, lang, 'vegetarian')).toHaveAttribute('aria-pressed', 'true');
			await expectFiltersButton(page, lang, 1);
			await expectSameDocument(page, 'after a chip press');
		});

		test(`${lang}: Vegetarian off again restores the full list`, async ({ page }) => {
			skipOnDesktop(page);
			await openPopular(page, lang, '&f=vegetarian');
			await press(page, lang, 'vegetarian');
			await expectUrl(page, `/${lang}/?tab=popular`);
			await expectDishes(page, DISH_KEYS, 'vegetarian off');
			await expect(quickChip(page, lang, 'vegetarian')).toHaveAttribute('aria-pressed', 'false');
			await expectFiltersButton(page, lang, 0);
		});
	}

	test('Summer then Vegetarian: canonical URL, AND across groups → gazpacho, "Filters · 2"', async ({
		page
	}) => {
		skipOnDesktop(page);
		await openPopular(page, 'en');
		await press(page, 'en', 'summer');
		await expectUrl(page, '/en/?tab=popular&f=summer');
		await press(page, 'en', 'vegetarian');
		await expectUrl(page, '/en/?tab=popular&f=vegetarian&f=summer');
		await expectDishes(page, ['gazpacho'], 'vegetarian AND summer');
		await expect(resultCount(page)).toHaveText('1 dish');
		await expectFiltersButton(page, 'en', 2);
	});

	test('a sheet-only filter in the URL counts on the Filters button, presses no chip', async ({
		page
	}) => {
		skipOnDesktop(page);
		await openPopular(page, 'en', '&f=pork');
		await expectDishes(page, ['cocido', 'croquetas'], 'pork');
		await expectFiltersButton(page, 'en', 1);
		expect(await pressedChips(page, 'en', QUICK_IDS)).toEqual([]);
	});

	test('unknown ids in the URL are ignored', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en', '&f=vegan&f=summer');
		await expectDishes(page, ['gazpacho'], 'vegan (unknown) + summer');
		await expectFiltersButton(page, 'en', 1);
	});
});

test.describe('Popular (mobile): the URL restores the state', () => {
	test('a reload shows the same dishes and pressed chips', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en', '&f=quick&f=desserts');
		await expectDishes(page, ['torrijas'], 'quick AND desserts');
		await page.reload({ waitUntil: 'networkidle' });
		await expectDishes(page, ['torrijas'], 'after reload');
		expect(await pressedChips(page, 'en', QUICK_IDS)).toEqual(['quick', 'desserts']);
		await expectFiltersButton(page, 'en', 2);
	});

	test('a chip press survives a reload', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'ru');
		await press(page, 'ru', 'quick');
		await expectUrl(page, '/ru/?tab=popular&f=quick');
		await page.reload({ waitUntil: 'networkidle' });
		await expectDishes(
			page,
			['tortilla', 'gazpacho', 'croquetas', 'torrijas'],
			'quick after reload'
		);
		await expect(quickChip(page, 'ru', 'quick')).toHaveAttribute('aria-pressed', 'true');
	});

	for (const lang of LOCALES) {
		test(`${lang}: ?f=vegetarian&f=quick shows the same dishes as every other locale`, async ({
			page
		}) => {
			skipOnDesktop(page);
			await openPopular(page, lang, '&f=vegetarian&f=quick');
			await expectDishes(page, ['tortilla', 'gazpacho'], `${lang} vegetarian AND quick`);
			const names = ['tortilla', 'gazpacho'].map((key) => DISH_NAMES[lang][key as 'tortilla']);
			await expect(dishCards(page).locator('h3')).toHaveText(names);
			expect(await pressedChips(page, lang, QUICK_IDS)).toEqual(['vegetarian', 'quick']);
		});
	}
});

test.describe('Popular (mobile): nothing matches', () => {
	for (const lang of LOCALES) {
		const copy = POPULAR_COPY[lang];
		test(`${lang}: "${copy.noMatch}" and "${copy.clearAll}" restores the full list`, async ({
			page
		}) => {
			skipOnDesktop(page);
			await openPopular(page, lang, '&f=desserts&f=summer');
			await expect(dishCards(page)).toHaveCount(0);
			await expect(noMatch(page)).toBeVisible();
			await expect(noMatch(page)).toContainText(copy.noMatch);
			await expect(resultCount(page)).toHaveText(copy.dishes[0]);
			await noMatch(page)
				.getByRole('button', { name: copy.clearAll, exact: true })
				.or(noMatch(page).getByRole('link', { name: copy.clearAll, exact: true }))
				.click();
			await expectUrl(page, `/${lang}/?tab=popular`);
			await expectDishes(page, DISH_KEYS, 'after Clear all');
			await expect(noMatch(page)).toHaveCount(0);
			await expectFiltersButton(page, lang, 0);
		});
	}

	// Clear all replaces the entry, as a chip does, and the link goes with
	// the empty state, so focus moves on: to the Filters button on mobile,
	// and to the result count on desktop. FE-5 PR 3 keeps the count: it is
	// where the empty state was, it reads the restored total, and the next
	// Tab reaches the first card (the sidebar's own Clear all keeps focus).
	test('Clear all replaces the entry and moves focus (mobile: Filters, desktop: the count)', async ({
		page
	}) => {
		await openPopular(page, 'en', '&f=desserts&f=summer');
		await markDocument(page);
		const before = await historyLength(page);
		await noMatch(page).getByRole('link', { name: POPULAR_COPY.en.clearAll, exact: true }).click();
		await expectUrl(page, '/en/?tab=popular');
		await expectDishes(page, DISH_KEYS, 'after Clear all');
		expect(await historyLength(page), 'want the entry replaced, not pushed').toBe(before);
		await expectSameDocument(page, 'after Clear all');
		const target = isDesktopPage(page) ? resultCount(page) : filtersButton(page);
		await expect(target).toBeFocused();
	});

	test('reached by chips: Desserts then Summer empties the list', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en');
		await press(page, 'en', 'desserts');
		await expectDishes(page, ['torrijas', 'arrozleche'], 'desserts');
		await press(page, 'en', 'summer');
		await expectUrl(page, '/en/?tab=popular&f=desserts&f=summer');
		await expect(dishCards(page)).toHaveCount(0);
		await expect(noMatch(page)).toBeVisible();
	});
});

test.describe('Popular (mobile): screen frame', () => {
	test('the list scrolls in its own container; the page never scrolls', async ({ page }) => {
		skipOnDesktop(page);
		await openPopular(page, 'en');
		const scroller = await listScroller(page);
		expect(scroller.found, 'got no scrolling ancestor for the card list').toBe(true);
		expect(scroller.scrollHeight, 'want seven cards to overflow the list').toBeGreaterThan(
			scroller.clientHeight
		);
		const barBefore = await boxOf(filterBar(page), 'the filter bar');
		await scrollListToEnd(page);
		await expect(dishCards(page).last()).toBeInViewport();
		const scrolled = await page.evaluate(() => {
			window.scrollTo(0, 5000);
			return {
				y: window.scrollY,
				overflow: document.scrollingElement!.scrollHeight - window.innerHeight
			};
		});
		expect(scrolled.y, 'got the page scrolled').toBe(0);
		expect(scrolled.overflow, 'got a page taller than the viewport').toBeLessThanOrEqual(0);
		const barAfter = await boxOf(filterBar(page), 'the filter bar');
		expect(barAfter.y, 'got the filter bar scrolled away with the list').toBe(barBefore.y);
	});

	test('ru at 360px: chip labels whole, the row scrolls sideways with no scrollbar', async ({
		page
	}, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium-mobile-360', 'the narrow ru check runs at 360px');
		await openPopular(page, 'ru', '&f=quick');
		const report = await filterBar(page).evaluate((bar) => {
			const buttons = [...bar.querySelectorAll('button')];
			let row: HTMLElement | null = buttons[0].parentElement;
			while (row && !buttons.every((b) => row!.contains(b))) row = row.parentElement;
			return {
				clipped: buttons
					.filter(
						(b) =>
							b.scrollWidth > b.clientWidth + 1 || getComputedStyle(b).textOverflow === 'ellipsis'
					)
					.map((b) => b.textContent?.trim()),
				overflowX: row ? getComputedStyle(row).overflowX : 'none',
				scrollbar: row ? row.offsetHeight - row.clientHeight : -1,
				pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
			};
		});
		expect(report.clipped, 'got clipped chip labels').toEqual([]);
		expect(['auto', 'scroll']).toContain(report.overflowX);
		expect(report.scrollbar, 'got a visible scrollbar under the chips').toBe(0);
		expect(report.pageOverflow, 'got the chips widening the page').toBeLessThanOrEqual(0);
		await expect(quickChip(page, 'ru', 'summer')).toHaveText(POPULAR_COPY.ru.quick.summer);
	});
});

test.describe('Popular: the panel has its own heading (mobile and desktop)', () => {
	for (const lang of LOCALES) {
		const name = POPULAR_COPY[lang].popular;
		test(`${lang}: an <h2> "${name}" in the Popular panel`, async ({ page }) => {
			await openPopular(page, lang);
			const heading = popularPanel(page).getByRole('heading', { level: 2, name, exact: true });
			await expect(heading).toHaveCount(1);
		});
	}
});
