import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { MOCK_DATA_TAG } from '../testutil/e2e-target';
import { getRaw, redirectTarget } from '../testutil/e2e';
import { gotoHydrated, isDesktopPage, onlyVisible } from '../testutil/home-e2e';
import { expectUrl } from '../testutil/home-flow-e2e';
import { expectSheetPeek } from '../testutil/region-e2e';
import {
	dishCard,
	expectDishes,
	filtersSheet,
	openFiltersSheet,
	resultCount,
	sheetChip,
	sheetRowHrefs,
	sidebarChip,
	skipOnDesktop,
	skipOnMobile
} from '../testutil/popular-e2e';
import { POPULAR_COPY, SHEET_COPY } from '../testutil/popular-copy';
import { RECIPE_TEST_IDS } from '../testutil/recipe-copy';
import { DISHES, resultOption, resultGroup, searchFor, VARIATIONS } from '../testutil/search-e2e';
import { dropdownGroup, dropdownOption, typeInDesktopSearch } from '../testutil/desktop-search-e2e';
import {
	ALLIOLI,
	ARROZ_BLANCO,
	ARROZ_BLANCO_FIRST_STEP,
	ARROZ_BLANCO_RECIPE_PATH,
	SPAIN_WIDE_LABEL,
	spainWideRecipePath
} from '../testutil/spain-wide';
import { backLink, variationCards } from '../testutil/variations-e2e';

// FE-11, Spanish (Spain-wide) variations end to end, on mobile and desktop
// (DATA_SOURCE=mock, the design samples). Sources: both READMEs -> routes and
// "Spanish (Spain-wide) variations (2026-11-23)"; stage FE-11 -> Tests (E2E):
// "Allioli shows two Spanish cards after regional ones (none here); Arroz
// blanco opens its recipe from Popular and search; the Basics filter; mobile
// and desktop, under the existing a11y checks" (the a11y checks run over the
// FE-11 states added to a11y-states-e2e.ts UI_STATES). Every test but "the
// map links no esp region" reads the mock bundle's Spanish variations
// (MOCK_DATA_TAG): a deployment's content may have none.

const MOVED_PERMANENTLY = 301;
const NOT_FOUND = 404;
const ALLIOLI_PATHS = ALLIOLI.variations.map((v) => spainWideRecipePath('en', ALLIOLI.key, v.slug));

const eyebrow = (page: Page): Locator => page.getByTestId(RECIPE_TEST_IDS.eyebrow);

// The back control the layout shows: the mobile bar's back link or the
// desktop pill.
function backControl(page: Page): Locator {
	if (isDesktopPage(page)) return onlyVisible(page.getByTestId('back-pill'));
	return backLink(page, 'en');
}

async function expectArrozBlancoRecipe(page: Page) {
	await expectUrl(page, ARROZ_BLANCO_RECIPE_PATH('en'));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(ARROZ_BLANCO.name.en);
	await expect(page.getByText(ARROZ_BLANCO_FIRST_STEP)).toBeVisible();
}

test.describe('Allioli: a dish of Spanish variations only', { tag: MOCK_DATA_TAG }, () => {
	test('/en/dishes/allioli: two Spanish cards, each to its /esp/ recipe', async ({ page }) => {
		await gotoHydrated(page, '/en/dishes/allioli');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(ALLIOLI.name.en);
		await expect(page.getByText('2 variations', { exact: true })).toBeVisible();
		await expect(variationCards(page)).toHaveCount(2);
		const hrefs = await variationCards(page).evaluateAll((cards) =>
			cards.map((c) => c.getAttribute('href'))
		);
		expect(hrefs).toEqual(ALLIOLI_PATHS);
		for (const [i, variation] of ALLIOLI.variations.entries()) {
			const card = variationCards(page).nth(i);
			await expect(card).toContainText(variation.name);
			await expect(card).toContainText(new RegExp(SPAIN_WIDE_LABEL.en, 'i'));
		}
	});

	test('ru: the Spanish card eyebrow reads "Испания"', async ({ page }) => {
		await gotoHydrated(page, '/ru/dishes/allioli');
		await expect(variationCards(page).first()).toContainText(/испания/i);
	});

	test('a card opens its Spanish recipe, eyebrow "Spanish"', async ({ page }) => {
		await gotoHydrated(page, '/en/dishes/allioli');
		await variationCards(page).nth(1).click();
		await expectUrl(page, ALLIOLI_PATHS[1]);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Allioli de codony');
		await expect(eyebrow(page)).toHaveText(/^spanish$/i);
	});

	test('the recipe back control returns to the Variations page', async ({ page }) => {
		await gotoHydrated(page, ALLIOLI_PATHS[0]);
		await expect(backControl(page)).toHaveAttribute('href', '/en/dishes/allioli');
	});

	test('mobile: its Popular card opens the dish sheet, rows to the /esp/ recipes', async ({
		page
	}) => {
		skipOnDesktop(page, 'the mobile dish sheet');
		await gotoHydrated(page, '/en/?tab=popular&f=basics');
		await dishCard(page, ALLIOLI.key).click();
		await expectUrl(page, '/en/?tab=popular&f=basics&dish=allioli');
		await expectSheetPeek(page, ALLIOLI.name.en);
		await expect.poll(() => sheetRowHrefs(page)).toEqual(ALLIOLI_PATHS);
	});
});

test.describe('Arroz blanco: a dish with exactly one variation', { tag: MOCK_DATA_TAG }, () => {
	test('GET /en/dishes/arrozblanco answers 301 to its recipe', async ({ request, baseURL }) => {
		const res = await getRaw(request, '/en/dishes/arrozblanco');
		expect(res.status(), `got ${res.status()}, want 301`).toBe(MOVED_PERMANENTLY);
		expect(redirectTarget(res, baseURL!)).toBe(ARROZ_BLANCO_RECIPE_PATH('en'));
	});

	test('the Spanish recipe URL renders on the server (200, the whole recipe)', async ({
		request
	}) => {
		const res = await getRaw(request, ARROZ_BLANCO_RECIPE_PATH('es'));
		expect(res.status()).toBe(200);
		expect(await res.text()).toContain('Dora los ajos enteros en el aceite');
	});

	test('an unknown slug is a 404, and so is esp as a region', async ({ request }) => {
		for (const path of [
			'/en/dishes/allioli/esp/allioli-de-nada',
			'/en/dishes/allioli/esp',
			'/en/regions/esp'
		]) {
			const res = await getRaw(request, path);
			expect(res.status(), `${path}: got ${res.status()}, want 404`).toBe(NOT_FOUND);
		}
	});

	test('opens its recipe from its Popular card; back returns to Popular', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular&f=mains');
		await dishCard(page, ARROZ_BLANCO.key).click();
		await expectArrozBlancoRecipe(page);
		await expect(onlyVisible(page.getByRole('dialog'))).toHaveCount(0);
		await backControl(page).click();
		await expectUrl(page, '/en/?tab=popular&f=mains');
	});

	test('on a direct load the back control goes to Popular', async ({ page }) => {
		await gotoHydrated(page, ARROZ_BLANCO_RECIPE_PATH('en'));
		await expect(backControl(page)).toHaveAttribute('href', '/en/?tab=popular');
		if (isDesktopPage(page)) await expect(backControl(page)).toHaveText(POPULAR_COPY.en.popular);
	});

	test('a browser on /en/dishes/arrozblanco lands on the recipe', async ({ page }) => {
		await page.goto('/en/dishes/arrozblanco', { waitUntil: 'networkidle' });
		await expectArrozBlancoRecipe(page);
	});
});

test.describe('search finds Spanish variations', { tag: MOCK_DATA_TAG }, () => {
	test('mobile: the dish result opens the Arroz blanco recipe', async ({ page }) => {
		skipOnDesktop(page, 'the mobile search overlay');
		await gotoHydrated(page, '/en/');
		await searchFor(page, 'en', 'arroz blanco');
		await resultOption(resultGroup(page, 'en', DISHES), ARROZ_BLANCO.name.en).click();
		await expectArrozBlancoRecipe(page);
	});

	test('mobile: the variation result reads "Spanish · Allioli"', async ({ page }) => {
		skipOnDesktop(page, 'the mobile search overlay');
		await gotoHydrated(page, '/en/');
		await searchFor(page, 'en', 'morter');
		const option = resultOption(resultGroup(page, 'en', VARIATIONS), 'Allioli de morter');
		await expect(option).toContainText('Spanish · Allioli');
	});

	test('desktop: the dish result opens the Arroz blanco recipe', async ({ page }) => {
		skipOnMobile(page, 'the desktop search dropdown');
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', 'arroz blanco');
		await dropdownOption(dropdownGroup(page, 'en', DISHES), ARROZ_BLANCO.name.en).click();
		await expectArrozBlancoRecipe(page);
	});

	test('desktop: a Spanish variation result opens its recipe', async ({ page }) => {
		skipOnMobile(page, 'the desktop search dropdown');
		await gotoHydrated(page, '/en/');
		await typeInDesktopSearch(page, 'en', 'codony');
		const option = dropdownOption(dropdownGroup(page, 'en', VARIATIONS), 'Allioli de codony');
		await expect(option).toContainText('Spanish · Allioli');
		await option.click();
		await expectUrl(page, ALLIOLI_PATHS[1]);
	});
});

test.describe('the Basics filter', { tag: MOCK_DATA_TAG }, () => {
	test('mobile: Basics in the Filters sheet keeps only Allioli', async ({ page }) => {
		skipOnDesktop(page, 'the mobile Filters sheet');
		await gotoHydrated(page, '/en/?tab=popular');
		await openFiltersSheet(page, 'en');
		await expect(sheetChip(page, 'en', 'basics')).toHaveText(SHEET_COPY.en.labels.basics);
		await sheetChip(page, 'en', 'basics').click();
		await expectUrl(page, '/en/?tab=popular&f=basics');
		await expect(filtersSheet(page, 'en')).toBeVisible();
		await expectDishes(page, [ALLIOLI.key], 'basics');
		await expect(resultCount(page)).toHaveText(POPULAR_COPY.en.dishes[1]);
	});

	test('desktop: Basics in the sidebar keeps only Allioli', async ({ page }) => {
		skipOnMobile(page);
		await gotoHydrated(page, '/es/?tab=popular');
		await sidebarChip(page, 'es', 'basics').click();
		await expectUrl(page, '/es/?tab=popular&f=basics');
		await expectDishes(page, [ALLIOLI.key], 'basics');
		await expect(sidebarChip(page, 'es', 'basics')).toHaveAttribute('aria-pressed', 'true');
		await expect(resultCount(page)).toHaveText(POPULAR_COPY.es.dishes[1]);
	});

	test('Basics OR Mains: Allioli and the mains, Arroz blanco included', async ({ page }) => {
		await gotoHydrated(page, '/en/?tab=popular&f=mains&f=basics');
		await expectDishes(page, ['paella', 'cocido', 'allioli', 'arrozblanco'], 'basics OR mains');
	});
});

test.describe('the map and region lists leave Spanish variations out', () => {
	test('the map links no esp region', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await expect(page.locator('a[href="/en/regions/esp"]')).toHaveCount(0);
	});

	test(
		"a region's list has no Spanish variation (Catalonia)",
		{ tag: MOCK_DATA_TAG },
		async ({ page }) => {
			await gotoHydrated(page, '/en/regions/cat');
			const allioli = page.locator('a[href*="/dishes/allioli/"], a[href*="/dishes/arrozblanco/"]');
			await expect(allioli).toHaveCount(0);
		}
	);
});
