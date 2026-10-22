import { expect, test, type Locator, type Page, type TestInfo } from '../testutil/e2e-test';
import { LOCALES } from '../testutil/e2e';
import {
	computedStyle,
	expectSameDocument,
	gotoHydrated,
	isDesktopPage,
	markDocument,
	onlyVisible,
	pathAndQuery,
	tab,
	HOME_COPY,
	tokenValue
} from '../testutil/home-e2e';
import {
	DISH_KEYS,
	FILTER_IDS,
	GROUP_IDS,
	GROUP_KEYS,
	HANDLE_LABELS,
	POPULAR_COPY,
	QUICK_IDS,
	SHEET_COPY,
	TORTILLA_SHEET,
	VARIATION_REGIONS,
	type PopularLocale
} from '../testutil/popular-copy';
import {
	clearAllInSheet,
	dishCard,
	dishSheet,
	expectDishes,
	expectFiltersButton,
	expectFiltersSheetClosed,
	expectFiltersSheetOpen,
	filtersButton,
	filtersSheet,
	focusIsIn,
	openFiltersSheet,
	openFiltersSheetByKeyboard,
	pressedChips,
	quickChip,
	seeAllLink,
	sheetChip,
	sheetGroup,
	sheetPressedIds,
	sheetRowHrefs,
	showResults,
	skipOnDesktop,
	tapTopScrim
} from '../testutil/popular-e2e';
import {
	expectSheetExpanded,
	expectSheetHidden,
	expectSheetPeek,
	historyLength
} from '../testutil/region-e2e';

// FE-5 PR 2, the mobile Popular sheets end to end: the Filters sheet and the
// dish detail sheet (stage FE-5 -> Filters sheet, Dish detail sheet,
// Acceptance).
//
// Sources:
// - Mobile README -> Filters sheet L102–111: "Overlay above everything (z
//   above home sheet) ... Scrim --scrim-filter, 300ms, tap closes. Header
//   row: "Filters" (Instrument Serif 23px) + "Clear all" (12px/600, accent).
//   Four groups ... The quick chips on the bar are the same filters (they
//   stay in sync). Button "Show results" (primary) closes the sheet."
//   Prototype L311–349: Clear all only empties the filters (the sheet stays
//   open); "Show results" is "border-radius:13px;padding:14px;
//   font-size:13.5px" (PrimaryButton size="compact"); neither the header nor
//   the button shows a live count, so there is none.
// - Mobile README -> Dish detail sheet L95–100 ("Same sheet shell and states
//   as the region sheet"; "See all variations" → Variations page); Popular
//   body L93: "Tap → opens the Dish detail sheet". Prototype L1220/L1268: a
//   card opens the sheet in peek; the scrim closes it.
// - Both READMEs -> State L186–200: "Back on the Variations page returns to
//   home with its previous state intact. Switching tabs closes any open
//   sheet in 2a." Accessibility L202–205: "Sheets: focus-trap when
//   expanded, Escape closes."
// - D-FE5-2: "?dish=<dishKey> via shallow routing on mobile; ignored on
//   desktop; an unknown key opens nothing." Small decisions: toggling or
//   clearing a filter drops `dish`.
//
// Decisions pinned here (FE-5 PR 2):
// - The Filters sheet's open state is IN MEMORY, not in the URL. Reasons:
//   the stage doesn't ask for it; its chips are buttons that need
//   JavaScript anyway (Small decisions), so a no-JS URL that opens it would
//   offer nothing usable; every filter press replaces the entry and
//   toggleFilterHref drops every other param, so a URL flag would have to
//   survive that; and Back should leave the tab, not replay a sheet. So
//   opening and closing it never touches the URL or the history, and a
//   reload shows it closed.
// - The Filters button is a <button aria-haspopup="dialog" aria-expanded>;
//   focus moves into the open sheet and returns to the button when it
//   closes (Show results, Escape, scrim), whether it was opened by keyboard
//   or by pointer. A chip pressed inside the sheet keeps the sheet open and
//   keeps focus on that chip (the navigation is replace + reset: false).
// - The dish sheet comes from the URL only: a card is a link (pushes an
//   entry, same document, focus stays on the card: data-sveltekit-reset=
//   "false"); Back closes the sheet; the scrim and Escape close it by
//   navigating to the same URL without `dish` as a NEW entry (as the region
//   sheet does), so Back reopens it. The handle's expanded state is local
//   (no URL, no history), and a dish URL always opens in peek.
// - Closing the dish sheet returns focus to the card it was opened from.
// - Switching tabs closes it (tabHref is always the bare tab URL).
// - Back from /:lang/dishes/:dishKey restores the tab, the filters and the
//   dish sheet (in peek), from the URL.
// - Assumption: a variation row in the dish sheet links to its recipe page
//   (/:lang/dishes/:dishKey/:regionKey), as the region sheet's rows do.
// - Desktop (≥ 860px) ignores ?dish: nothing opens and Escape does nothing.
// - Stacking: from a dish sheet in peek the Filters button is reachable by
//   keyboard (peek isn't modal); the Filters sheet opens above it, and
//   Escape closes the topmost layer first (escape-layers.ts).

const VEGETARIAN_DISHES = ['tortilla', 'gazpacho', 'arrozleche'];
const TORTILLA_EN = TORTILLA_SHEET.en;
// Enough Tabs to go round the whole Filters sheet: header, 12 chips, button.
const FILTERS_SHEET_TABS = FILTER_IDS.length + 4;
// More Tabs than a peek-sized dish sheet has controls in view.
const DISH_SHEET_TABS = 10;

async function openPopular(page: Page, lang: PopularLocale, query = '') {
	await gotoHydrated(page, `/${lang}/?tab=popular${query}`);
}

async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

function skipUnlessDesktop(page: Page) {
	test.skip(!isDesktopPage(page), 'desktop ignores the mobile sheets (≥ 860px)');
}

async function tapCard(page: Page, key: string) {
	await dishCard(page, key).click();
	await page.waitForURL((url) => url.searchParams.get('dish') === key);
}

// Keyboard activation of a card: focus stays on it (reset: false).
async function activateCard(page: Page, key: string) {
	await dishCard(page, key).focus();
	await page.keyboard.press('Enter');
	await page.waitForURL((url) => url.searchParams.get('dish') === key);
}

function sheetHandle(page: Page, lang: PopularLocale = 'en'): Locator {
	return dishSheet(page).getByRole('button', { name: HANDLE_LABELS[lang], exact: true });
}

async function expandDishSheet(page: Page, name: string, lang: PopularLocale = 'en') {
	await sheetHandle(page, lang).click();
	await expectSheetExpanded(page, name);
}

async function expectTabStaysInside(page: Page, container: Locator) {
	for (let i = 0; i < FILTERS_SHEET_TABS; i++) {
		await page.keyboard.press('Tab');
		expect(await focusIsIn(container), `got focus out of the sheet after ${i + 1} Tabs`).toBe(true);
	}
}

test.describe('Filters sheet (mobile): opening', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test('the Filters button announces a dialog and starts collapsed', async ({ page }) => {
		await openPopular(page, 'en');
		await expect(filtersButton(page)).toHaveAttribute('aria-haspopup', 'dialog');
		await expect(filtersButton(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(filtersSheet(page, 'en')).toHaveCount(0);
	});

	for (const lang of LOCALES) {
		const copy = SHEET_COPY[lang];
		test(`${lang}: the button opens "${POPULAR_COPY[lang].filters}" with four groups, ${copy.showResults}`, async ({
			page
		}) => {
			await openPopular(page, lang);
			await openFiltersSheet(page, lang);
			for (const key of GROUP_KEYS) {
				const want = GROUP_IDS[key].map((id) => copy.labels[id]);
				await expect(sheetGroup(page, lang, key).getByRole('button')).toHaveText(want);
			}
			const sheet = filtersSheet(page, lang);
			await expect(
				sheet.getByRole('heading', { level: 2, name: POPULAR_COPY[lang].filters, exact: true })
			).toBeVisible();
			await expect(clearAllInSheet(page, lang)).toBeVisible();
			// No live count: the button is the plain label.
			await expect(showResults(page, lang)).toHaveText(copy.showResults);
		});
	}

	test(
		'opening moves focus into the sheet; the URL and the history stay',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en', '&f=quick');
			const entries = await historyLength(page);
			await openFiltersSheet(page, 'en');
			await expect.poll(() => focusIsIn(filtersSheet(page, 'en'))).toBe(true);
			expect(pathAndQuery(page), 'got the URL changed by opening').toBe('/en/?tab=popular&f=quick');
			expect(await historyLength(page), 'got a history entry for opening').toBe(entries);
		}
	);

	test('the sheet shows the URL filters as pressed chips', async ({ page }) => {
		await openPopular(page, 'en', '&f=pork&f=winter&f=quick');
		await openFiltersSheet(page, 'en');
		expect(await sheetPressedIds(page, 'en', FILTER_IDS)).toEqual(['pork', 'quick', 'winter']);
	});

	test('in memory: a reload shows the sheet closed', async ({ page }) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		await page.reload({ waitUntil: 'networkidle' });
		await expectFiltersSheetClosed(page, 'en');
	});
});

test.describe('Filters sheet (mobile): chips drive the URL', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test('a sheet chip writes f=, keeps the sheet open and focus on the chip, replaces the entry', async ({
		page
	}) => {
		await openPopular(page, 'en');
		await markDocument(page);
		const entries = await historyLength(page);
		await openFiltersSheet(page, 'en');
		await sheetChip(page, 'en', 'seafood').click();
		await expectUrl(page, '/en/?tab=popular&f=seafood');
		await expect(sheetChip(page, 'en', 'seafood')).toHaveAttribute('aria-pressed', 'true');
		await expectFiltersSheetOpen(page, 'en');
		await expect(sheetChip(page, 'en', 'seafood')).toBeFocused();
		await expectDishes(page, ['paella'], 'seafood');
		await expectFiltersButton(page, 'en', 1);
		expect(await historyLength(page), 'want the entry replaced').toBe(entries);
		await expectSameDocument(page, 'after a sheet chip press');
	});

	test('OR within a group, AND across groups, canonical URL', async ({ page }) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		await sheetChip(page, 'en', 'seafood').click();
		await expectUrl(page, '/en/?tab=popular&f=seafood');
		await sheetChip(page, 'en', 'vegetarian').click();
		await expectUrl(page, '/en/?tab=popular&f=vegetarian&f=seafood');
		await expectDishes(page, ['tortilla', 'paella', 'gazpacho', 'arrozleche'], 'veg OR seafood');
		await sheetChip(page, 'en', 'mains').click();
		await expectUrl(page, '/en/?tab=popular&f=vegetarian&f=seafood&f=mains');
		await expectDishes(page, ['paella'], '(veg OR seafood) AND mains');
		await expectFiltersButton(page, 'en', 3);
	});

	test('a pressed sheet chip toggles off again', async ({ page }) => {
		await openPopular(page, 'en', '&f=easter');
		await openFiltersSheet(page, 'en');
		await sheetChip(page, 'en', 'easter').click();
		await expectUrl(page, '/en/?tab=popular');
		await expect(sheetChip(page, 'en', 'easter')).toHaveAttribute('aria-pressed', 'false');
		await expectDishes(page, DISH_KEYS, 'Holy Week off');
	});

	test('quick chip → sheet: Vegetarian on the bar is pressed in the Diet group', async ({
		page
	}) => {
		await openPopular(page, 'es');
		await quickChip(page, 'es', 'vegetarian').click();
		await expectUrl(page, '/es/?tab=popular&f=vegetarian');
		await openFiltersSheet(page, 'es');
		await expect(sheetChip(page, 'es', 'vegetarian')).toHaveAttribute('aria-pressed', 'true');
		expect(await sheetPressedIds(page, 'es', FILTER_IDS)).toEqual(['vegetarian']);
	});

	test('sheet → quick chips: Quick and Summer pressed in the sheet press the bar chips', async ({
		page
	}) => {
		await openPopular(page, 'ru');
		await openFiltersSheet(page, 'ru');
		await sheetChip(page, 'ru', 'summer').click();
		await expectUrl(page, '/ru/?tab=popular&f=summer');
		await sheetChip(page, 'ru', 'quick').click();
		await expectUrl(page, '/ru/?tab=popular&f=quick&f=summer');
		await showResults(page, 'ru').click();
		await expectFiltersSheetClosed(page, 'ru');
		expect(await pressedChips(page, 'ru', QUICK_IDS)).toEqual(['quick', 'summer']);
		await expectDishes(page, ['gazpacho'], 'quick AND summer');
	});

	test('a sheet-only filter turned off in the sheet clears the bar count', async ({ page }) => {
		await openPopular(page, 'en', '&f=pork');
		await openFiltersSheet(page, 'en');
		await sheetChip(page, 'en', 'pork').click();
		await expectUrl(page, '/en/?tab=popular');
		await showResults(page, 'en').click();
		await expectFiltersButton(page, 'en', 0);
	});

	for (const lang of LOCALES) {
		const clearAll = POPULAR_COPY[lang].clearAll;
		test(`${lang}: "${clearAll}" empties the filters, the sheet stays open`, async ({ page }) => {
			await openPopular(page, lang, '&f=vegetarian&f=summer');
			const entries = await historyLength(page);
			await openFiltersSheet(page, lang);
			await clearAllInSheet(page, lang).click();
			await expectUrl(page, `/${lang}/?tab=popular`);
			expect(await sheetPressedIds(page, lang, FILTER_IDS)).toEqual([]);
			await expectFiltersSheetOpen(page, lang);
			await expect.poll(() => focusIsIn(filtersSheet(page, lang))).toBe(true);
			await expectDishes(page, DISH_KEYS, 'after Clear all');
			expect(await historyLength(page), 'want the entry replaced').toBe(entries);
		});
	}
});

test.describe('Filters sheet (mobile): closing', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test(
		'"Show results" closes it; focus returns to the Filters button; the URL stays',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en', '&f=quick');
			await openFiltersSheet(page, 'en');
			await showResults(page, 'en').click();
			await expectFiltersSheetClosed(page, 'en');
			await expect(filtersButton(page)).toBeFocused();
			expect(pathAndQuery(page)).toBe('/en/?tab=popular&f=quick');
		}
	);

	test('Escape closes it; focus returns to the Filters button', async ({ page }) => {
		await openPopular(page, 'en');
		await filtersButton(page).focus();
		await page.keyboard.press('Enter');
		await expectFiltersSheetOpen(page, 'en');
		await page.keyboard.press('Escape');
		await expectFiltersSheetClosed(page, 'en');
		await expect(filtersButton(page)).toBeFocused();
		expect(pathAndQuery(page)).toBe('/en/?tab=popular');
	});

	test(
		'a scrim tap closes it; focus returns to the Filters button',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en');
			await openFiltersSheet(page, 'en');
			await tapTopScrim(page);
			await expectFiltersSheetClosed(page, 'en');
			await expect(filtersButton(page)).toBeFocused();
		}
	);

	test('closing after a chip press: the list behind shows the new filters', async ({ page }) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		await sheetChip(page, 'en', 'winter').click();
		await expectUrl(page, '/en/?tab=popular&f=winter');
		await page.keyboard.press('Escape');
		await expectFiltersSheetClosed(page, 'en');
		await expectDishes(page, ['cocido'], 'winter');
		await expectFiltersButton(page, 'en', 1);
	});
});

test.describe('Filters sheet (mobile): keyboard and layout', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test(
		'Tab and Shift+Tab stay inside the open sheet',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en');
			await openFiltersSheet(page, 'en');
			const sheet = filtersSheet(page, 'en');
			await expectTabStaysInside(page, sheet);
			await page.keyboard.down('Shift');
			await expectTabStaysInside(page, sheet);
			await page.keyboard.up('Shift');
		}
	);

	test('header: "Filters" 23px Instrument Serif, "Clear all" 12px/600 accent text', async ({
		page
	}) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		const title = filtersSheet(page, 'en').getByRole('heading', { level: 2, name: 'Filters' });
		const titleStyle = await computedStyle(title, ['font-size', 'font-family']);
		expect(titleStyle['font-size']).toBe('23px');
		expect(titleStyle['font-family']).toBe(
			await tokenValue(page, 'font-family', 'var(--font-display)')
		);
		const clear = await computedStyle(clearAllInSheet(page, 'en'), [
			'font-size',
			'font-weight',
			'color'
		]);
		expect(clear['font-size']).toBe('12px');
		expect(clear['font-weight']).toBe('600');
		expect(clear.color).toBe(await tokenValue(page, 'color', 'var(--accent-text)'));
	});

	test(
		'"Show results": the compact primary button (padding 14px, 13.5px, radius 13px), full width',
		{ tag: '@layout' },
		async ({ page }) => {
			await openPopular(page, 'en');
			await openFiltersSheet(page, 'en');
			const button = showResults(page, 'en');
			const got = await computedStyle(button, [
				'padding-top',
				'padding-left',
				'font-size',
				'font-weight',
				'border-top-left-radius',
				'background-color'
			]);
			expect(got['padding-top']).toBe('14px');
			expect(got['padding-left']).toBe('14px');
			expect(got['font-size']).toBe('13.5px');
			expect(got['font-weight']).toBe('600');
			expect(got['border-top-left-radius']).toBe(
				await tokenValue(page, 'border-top-left-radius', 'var(--radius-button-compact)')
			);
			expect(got['background-color']).toBe(
				await tokenValue(page, 'background-color', 'var(--bg-button)')
			);
			const sheetBox = await filtersSheet(page, 'en').boundingBox();
			const buttonBox = await button.boundingBox();
			const inner = sheetBox!.width - 2 * 20;
			expect(
				Math.abs(buttonBox!.width - inner),
				'want it the sheet width minus 20px each side'
			).toBeLessThanOrEqual(1);
		}
	);

	test('order: header, then the four groups, then "Show results" last', async ({ page }) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		const tops = async (locator: Locator) => (await locator.boundingBox())!.y;
		const header = await tops(clearAllInSheet(page, 'en'));
		const groups: number[] = [];
		for (const key of GROUP_KEYS) groups.push(await tops(sheetGroup(page, 'en', key)));
		const button = await tops(showResults(page, 'en'));
		expect([header, ...groups, button]).toEqual(
			[header, ...groups, button].toSorted((a, b) => a - b)
		);
	});

	test('the scrim is --scrim-filter, and the sheet sits above it', async ({ page }) => {
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		const want = await tokenValue(page, 'background-color', 'var(--scrim-filter)');
		const top = await page.evaluate(() => {
			const hit = document.elementFromPoint(window.innerWidth / 2, 8);
			return hit ? getComputedStyle(hit).backgroundColor : '';
		});
		expect(top, 'got something other than the Filters scrim over the header').toBe(want);
		const box = (await showResults(page, 'en').boundingBox())!;
		const onButton = await page.evaluate(
			([x, y]) =>
				document.elementFromPoint(x, y)?.closest('[role="dialog"]')?.getAttribute('aria-label'),
			[box.x + box.width / 2, box.y + box.height / 2] as const
		);
		expect(onButton, 'want the Filters sheet on top').toBe('Filters');
	});

	test(
		'ru at 360px: every chip label whole, nothing wider than the screen',
		{ tag: '@layout' },
		async ({ page }, testInfo) => {
			test.skip(
				testInfo.project.name !== 'chromium-mobile-360',
				'the narrow ru check runs at 360px'
			);
			await openPopular(page, 'ru');
			await openFiltersSheet(page, 'ru');
			for (const id of FILTER_IDS) {
				await expect(sheetChip(page, 'ru', id)).toHaveText(SHEET_COPY.ru.labels[id]);
			}
			const report = await filtersSheet(page, 'ru').evaluate((sheet) => ({
				clipped: [...sheet.querySelectorAll('button')]
					.filter((b) => b.scrollWidth > b.clientWidth + 1)
					.map((b) => b.textContent?.trim()),
				overflow: sheet.scrollWidth - sheet.clientWidth,
				pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
			}));
			expect(report.clipped, 'got clipped labels').toEqual([]);
			expect(report.overflow, 'got the sheet scrolling sideways').toBeLessThanOrEqual(0);
			expect(report.pageOverflow, 'got the page widened').toBeLessThanOrEqual(0);
		}
	);
});

test.describe('dish sheet (mobile): opening', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	for (const lang of LOCALES) {
		const want = TORTILLA_SHEET[lang];
		test(`${lang}: tapping the tortilla card opens its sheet in peek, a new entry, no reload`, async ({
			page
		}) => {
			await openPopular(page, lang);
			await markDocument(page);
			const entries = await historyLength(page);
			await tapCard(page, 'tortilla');
			expect(pathAndQuery(page)).toBe(`/${lang}/?tab=popular&dish=tortilla`);
			await expectSheetPeek(page, want.name);
			const sheet = dishSheet(page);
			await expect(sheet.getByText(want.description, { exact: true })).toHaveCount(1);
			await expect(sheet.getByText(want.count, { exact: true })).toHaveCount(1);
			await expect(sheet.getByText(want.first.name, { exact: true })).toHaveCount(1);
			await expect(sheet.getByText(want.first.description, { exact: true })).toHaveCount(1);
			await expect(seeAllLink(page, lang)).toHaveAttribute('href', `/${lang}/dishes/tortilla`);
			expect(await historyLength(page), 'want a new history entry').toBe(entries + 1);
			await expectSameDocument(page, 'tapping a card');
		});
	}

	test('rows: one per variation, in region order, each to its recipe', async ({ page }) => {
		await openPopular(page, 'en');
		await tapCard(page, 'tortilla');
		const want = VARIATION_REGIONS.tortilla.map((r) => `/en/dishes/tortilla/${r}`);
		await expect.poll(() => sheetRowHrefs(page)).toEqual(want);
	});

	test('paella: region order (cat, ara, val, …), not bundle or count order', async ({ page }) => {
		await openPopular(page, 'en');
		await tapCard(page, 'paella');
		const want = VARIATION_REGIONS.paella.map((r) => `/en/dishes/paella/${r}`);
		await expect.poll(() => sheetRowHrefs(page)).toEqual(want);
	});

	test('the card link keeps the filters and opens the sheet over the filtered list', async ({
		page
	}) => {
		await openPopular(page, 'en', '&f=vegetarian');
		await tapCard(page, 'gazpacho');
		expect(pathAndQuery(page)).toBe('/en/?tab=popular&f=vegetarian&dish=gazpacho');
		await expectSheetPeek(page, 'Cold soups');
		await expectDishes(page, VEGETARIAN_DISHES, 'behind the sheet');
	});

	test('the cards opt out of focus reset (data-sveltekit-reset="false")', async ({ page }) => {
		await openPopular(page, 'en');
		const resets = await page
			.locator('[data-testid="dish-card"]')
			.evaluateAll((cards) =>
				cards.map((c) => c.closest('[data-sveltekit-reset]')?.getAttribute('data-sveltekit-reset'))
			);
		expect(resets).toEqual(DISH_KEYS.map(() => 'false'));
	});

	test('a deep link opens the sheet in peek', { tag: '@layout' }, async ({ page }) => {
		await openPopular(page, 'ru', '&dish=tortilla');
		await expectSheetPeek(page, TORTILLA_SHEET.ru.name);
	});

	test('an unknown dish key opens nothing: the list, no error page', async ({ page }) => {
		await openPopular(page, 'en', '&dish=bogus');
		await expectSheetHidden(page);
		await expectDishes(page, DISH_KEYS, 'unknown dish');
	});

	test('the handle toggles peek ↔ expanded; the URL and history stay', async ({ page }) => {
		await openPopular(page, 'en', '&dish=tortilla');
		const entries = await historyLength(page);
		await expandDishSheet(page, TORTILLA_EN.name);
		expect(pathAndQuery(page)).toBe('/en/?tab=popular&dish=tortilla');
		await sheetHandle(page).click();
		await expectSheetPeek(page, TORTILLA_EN.name);
		expect(await historyLength(page), 'got a history entry for the handle').toBe(entries);
	});

	test('expanded traps focus in the sheet', async ({ page }) => {
		await openPopular(page, 'en', '&dish=gazpacho');
		await expandDishSheet(page, 'Cold soups');
		for (let i = 0; i < DISH_SHEET_TABS; i++) {
			await page.keyboard.press('Tab');
			expect(await focusIsIn(dishSheet(page)), `got focus out after ${i + 1} Tabs`).toBe(true);
		}
	});

	test('expanded: a row opens its recipe', async ({ page }) => {
		await openPopular(page, 'en', '&dish=tortilla');
		await expandDishSheet(page, TORTILLA_EN.name);
		await dishSheet(page).locator('a[href="/en/dishes/tortilla/gal"]').click();
		await page.waitForURL((url) => url.pathname === '/en/dishes/tortilla/gal');
	});
});

test.describe('dish sheet (mobile): closing', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test('Back closes it, in the same document', async ({ page }) => {
		await openPopular(page, 'en', '&f=quick');
		await markDocument(page);
		await tapCard(page, 'tortilla');
		await expectSheetPeek(page, TORTILLA_EN.name);
		await page.goBack();
		await expectUrl(page, '/en/?tab=popular&f=quick');
		await expectSheetHidden(page);
		await expectSameDocument(page, 'Back from the dish sheet');
	});

	test(
		'a scrim tap drops ?dish, keeps the filters, as a new entry: Back reopens',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en', '&f=vegetarian&dish=tortilla');
			await expectSheetPeek(page, TORTILLA_EN.name);
			const entries = await historyLength(page);
			await tapTopScrim(page);
			await expectUrl(page, '/en/?tab=popular&f=vegetarian');
			await expectSheetHidden(page);
			expect(await historyLength(page), 'want a new entry for the close').toBe(entries + 1);
			await page.goBack();
			await expectUrl(page, '/en/?tab=popular&f=vegetarian&dish=tortilla');
			await expectSheetPeek(page, TORTILLA_EN.name);
		}
	);

	test('Escape closes it like the scrim (peek)', async ({ page }) => {
		await openPopular(page, 'en', '&dish=paella');
		await expectSheetPeek(page, 'Rice dishes');
		await page.keyboard.press('Escape');
		await expectUrl(page, '/en/?tab=popular');
		await expectSheetHidden(page);
	});

	test('Escape closes the expanded sheet too', async ({ page }) => {
		await openPopular(page, 'en', '&dish=tortilla');
		await expandDishSheet(page, TORTILLA_EN.name);
		await page.keyboard.press('Escape');
		await expectUrl(page, '/en/?tab=popular');
		await expectSheetHidden(page);
	});

	test(
		'closing from peek returns focus to the card that opened it',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en');
			await activateCard(page, 'croquetas');
			await expectSheetPeek(page, 'Croquetas');
			await expect(dishCard(page, 'croquetas'), 'want focus kept on the card').toBeFocused();
			await page.keyboard.press('Escape');
			await expectUrl(page, '/en/?tab=popular');
			await expectSheetHidden(page);
			await expect(dishCard(page, 'croquetas'), 'want focus back on the card').toBeFocused();
		}
	);

	// WebKit doesn't focus a link on tap, so after a pointer open the sheet
	// must return focus to the tapped card without relying on it. Chromium
	// does focus it, so the test cancels mousedown (no focus move, the click
	// still navigates) to stand in for WebKit.
	test(
		'closing after a pointer tap returns focus to the tapped card',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openPopular(page, 'en');
			const card = dishCard(page, 'gazpacho');
			await card.evaluate((link) =>
				link.addEventListener('mousedown', (event) => event.preventDefault())
			);
			await page.evaluate(() => document.activeElement?.setAttribute('data-focus-before-tap', ''));
			await tapCard(page, 'gazpacho');
			await expectSheetPeek(page, 'Cold soups');
			await expect(card, 'want the tap to leave focus alone').not.toBeFocused();
			const kept = await page.evaluate(
				() => document.activeElement?.hasAttribute('data-focus-before-tap') ?? false
			);
			expect(kept, 'want focus still where it was before the tap').toBe(true);
			await page.keyboard.press('Escape');
			await expectUrl(page, '/en/?tab=popular');
			await expectSheetHidden(page);
			await expect(card, 'want focus back on the tapped card').toBeFocused();
		}
	);

	test('closing from expanded returns focus to the card too', async ({ page }) => {
		await openPopular(page, 'en');
		await activateCard(page, 'torrijas');
		const handle = sheetHandle(page);
		await handle.focus();
		await page.keyboard.press('Enter');
		await expectSheetExpanded(page, 'Fried sweets');
		await page.keyboard.press('Escape');
		await expectSheetHidden(page);
		await expect(dishCard(page, 'torrijas'), 'want focus back on the card').toBeFocused();
	});

	test('switching tabs closes it (arrow keys on the switch)', async ({ page }) => {
		await openPopular(page, 'en', '&dish=tortilla');
		await expectSheetPeek(page, TORTILLA_EN.name);
		await onlyVisible(tab(page, HOME_COPY.en.popular)).focus();
		await page.keyboard.press('ArrowLeft');
		await expectUrl(page, '/en/');
		await page.keyboard.press('ArrowRight');
		await expectUrl(page, '/en/?tab=popular');
		await expectSheetHidden(page);
	});

	test('a filter toggled while the sheet is open closes it (the list changed)', async ({
		page
	}) => {
		await openPopular(page, 'en', '&dish=tortilla');
		await expectSheetPeek(page, TORTILLA_EN.name);
		await quickChip(page, 'en', 'quick').focus();
		await page.keyboard.press('Enter');
		await expectUrl(page, '/en/?tab=popular&f=quick');
		await expectSheetHidden(page);
	});
});

test.describe('dish sheet (mobile): Back from the Variations page', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	for (const lang of LOCALES) {
		const want = TORTILLA_SHEET[lang];
		// One locale per engine: history doesn't change with the language.
		const tag = lang === 'en' ? ['@cross-browser'] : [];
		test(
			`${lang}: See all → /${lang}/dishes/tortilla, Back restores tab, filters and sheet`,
			{ tag },
			async ({ page }) => {
				await openPopular(page, lang, '&f=vegetarian');
				await tapCard(page, 'tortilla');
				await expandDishSheet(page, want.name, lang);
				await seeAllLink(page, lang).click();
				await expectUrl(page, `/${lang}/dishes/tortilla`);
				await expect(page.getByRole('heading', { level: 1, name: want.name })).toBeVisible();
				await page.goBack();
				await expectUrl(page, `/${lang}/?tab=popular&f=vegetarian&dish=tortilla`);
				await expectSheetPeek(page, want.name);
				await expect(tab(page, HOME_COPY[lang].popular).first()).toHaveAttribute(
					'aria-selected',
					'true'
				);
				await expect(quickChip(page, lang, 'vegetarian')).toHaveAttribute('aria-pressed', 'true');
				await expectDishes(page, VEGETARIAN_DISHES, 'restored list');
			}
		);
	}
});

test.describe('dish sheet (mobile) without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test(
		'/ru/?tab=popular&dish=tortilla: the server-rendered sheet rests in peek in Russian',
		{ tag: '@layout' },
		async ({ page }) => {
			await page.goto('/ru/?tab=popular&dish=tortilla');
			await expectSheetPeek(page, TORTILLA_SHEET.ru.name);
			await expect(
				dishSheet(page).getByText(TORTILLA_SHEET.ru.description, { exact: true })
			).toBeInViewport();
		}
	);
});

test.describe('stacking: the Filters sheet over the dish sheet (mobile)', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	async function openBoth(page: Page) {
		await openPopular(page, 'en', '&dish=tortilla');
		await expectSheetPeek(page, TORTILLA_EN.name);
		await openFiltersSheetByKeyboard(page, 'en');
	}

	test('the Filters sheet opens above the dish sheet', async ({ page }) => {
		await openBoth(page);
		const box = (await showResults(page, 'en').boundingBox())!;
		const top = await page.evaluate(
			([x, y]) =>
				document.elementFromPoint(x, y)?.closest('[role="dialog"]')?.getAttribute('aria-label'),
			[box.x + box.width / 2, box.y + box.height / 2] as const
		);
		expect(top, 'want the Filters sheet over the dish sheet').toBe('Filters');
	});

	test(
		'Escape closes the Filters sheet first, then the dish sheet',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openBoth(page);
			await page.keyboard.press('Escape');
			await expectFiltersSheetClosed(page, 'en');
			await expectSheetPeek(page, TORTILLA_EN.name);
			expect(pathAndQuery(page), 'got the dish sheet closed by the first Escape').toBe(
				'/en/?tab=popular&dish=tortilla'
			);
			await page.keyboard.press('Escape');
			await expectUrl(page, '/en/?tab=popular');
			await expectSheetHidden(page);
		}
	);

	test('a filter pressed in the Filters sheet closes the dish sheet under it', async ({ page }) => {
		await openBoth(page);
		await sheetChip(page, 'en', 'tapas').click();
		await expectUrl(page, '/en/?tab=popular&f=tapas');
		await expectFiltersSheetOpen(page, 'en');
		await expectSheetHidden(page);
	});
});

test.describe('desktop (≥ 860px) ignores the mobile sheets', () => {
	test.beforeEach(({ page }) => skipUnlessDesktop(page));

	test(
		'?dish=tortilla opens no sheet or panel; Escape changes nothing',
		{ tag: '@layout' },
		async ({ page }) => {
			await openPopular(page, 'en', '&dish=tortilla');
			await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
			await expect(onlyVisible(page.getByTestId('dish-details'))).toHaveCount(0);
			await page.keyboard.press('Escape');
			expect(pathAndQuery(page)).toBe('/en/?tab=popular&dish=tortilla');
		}
	);

	test('no Filters button and no Filters sheet', { tag: '@layout' }, async ({ page }) => {
		await openPopular(page, 'en');
		await expect(
			onlyVisible(page.getByRole('button', { name: 'Filters', exact: true }))
		).toHaveCount(0);
		await expect(filtersSheet(page, 'en')).toHaveCount(0);
	});
});

// Crossing 860px with ?dish: mobile peek ↔ nothing on desktop ↔ peek again.
test.describe('resizing across 860px with a dish sheet', () => {
	const PROJECT = 'chromium-desktop-1280';
	const MOBILE = { width: 390, height: 844 };
	const DESKTOP = { width: 1280, height: 800 };

	const onlyInResizeProject = (testInfo: TestInfo) =>
		test.skip(testInfo.project.name !== PROJECT, `resize checks run in ${PROJECT} only`);

	test('mobile peek → desktop: no sheet → mobile: peek again, URL kept', async ({
		page
	}, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(MOBILE);
		await openPopular(page, 'en', '&dish=tortilla');
		await expectSheetPeek(page, TORTILLA_EN.name);
		await page.setViewportSize(DESKTOP);
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		await page.setViewportSize(MOBILE);
		await expectSheetPeek(page, TORTILLA_EN.name);
		expect(pathAndQuery(page)).toBe('/en/?tab=popular&dish=tortilla');
	});

	// Desktop has no Filters sheet, so crossing 860px closes it for good: it
	// must not reopen (modal, trapping focus) on the way back.
	test('Filters sheet open → desktop → mobile: the sheet stays closed', async ({
		page
	}, testInfo) => {
		onlyInResizeProject(testInfo);
		await page.setViewportSize(MOBILE);
		await openPopular(page, 'en');
		await openFiltersSheet(page, 'en');
		await page.setViewportSize(DESKTOP);
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		await page.setViewportSize(MOBILE);
		await expectFiltersSheetClosed(page, 'en');
		const focusInSheet = await page.evaluate(
			() => document.activeElement?.closest('[role="dialog"][aria-label="Filters"]') != null
		);
		expect(focusInSheet, 'got focus trapped in the closed Filters sheet').toBe(false);
	});
});
