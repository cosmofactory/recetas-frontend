import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { gotoHydrated, isDesktopPage } from '../testutil/home-e2e';
import { HANDLE_LABELS, TORTILLA_SHEET } from '../testutil/popular-copy';
import { dishSheet, seeAllLink } from '../testutil/popular-e2e';
import {
	expectSheetExpanded,
	expectSheetHidden,
	expectSheetPeek,
	regionSheet,
	tapScrim
} from '../testutil/region-e2e';
import {
	expectFullyOnScreen,
	expectRowNeverBelow,
	expectScrolledToEnd,
	expectScrollKept,
	sheetBody,
	startSampling,
	stopSampling,
	visualViewportBottom
} from '../testutil/sheet-end-e2e';

// FE-9 FB-5 (padding part): a BottomSheet's content always ends on screen.
// In peek the sheet keeps its full height and is only moved down, so its
// body used to scroll to an end below the screen's bottom edge.
//
// Source: stage FE-9 -> FB-5: "The scroll content always ends visible:
// bottom padding = the off-screen part of the sheet in the current state +
// env(safe-area-inset-bottom) + spacing, in peek and expanded. Same check
// and fix for every BottomSheet user (the Popular dish sheet included).
// Tests: e2e at a phone viewport that scrolls the list to the end and
// asserts the last row is fully inside the viewport, in peek and expanded."
//
// BottomSheet users: RegionSheet and DishSheet (through UrlSheet). The
// Filters sheet is an OverlaySheet, not covered here.
//
// Regression (review): the end padding changes with the state, so the body
// must not clamp its scroll in one frame when the state changes: expanding
// from a scrolled peek keeps the last row on screen in every frame of the
// 450ms slide, and hiding keeps the scroll offset while the sheet slides out.
//
// Fixtures (mock bundle): Catalonia has the longest region list (6 rows,
// tied with Andalucía), the owner's report; Tortilla has the most variations
// (13). Its rows scroll in their own capped list, so the dish sheet's last
// row is "See all variations".

const LANG = 'es';
const CATALONIA = { key: 'cat', name: 'Cataluña', rowCount: 6 };
const REGION_ROWS = `a[href^="/${LANG}/dishes/"]`;
const TORTILLA = { key: 'tortilla', name: TORTILLA_SHEET.en.name };

function skipOnDesktop(page: Page) {
	test.skip(isDesktopPage(page), 'the mobile BottomSheet (< 860px)');
}

async function expandSheet(sheet: Locator, lang: keyof typeof HANDLE_LABELS) {
	await sheet.getByRole('button', { name: HANDLE_LABELS[lang], exact: true }).click();
}

async function expectRegionEndsOnScreen(page: Page) {
	const sheet = regionSheet(page);
	const rows = sheet.locator(REGION_ROWS);
	await expect(rows, 'want every Catalonia row in the sheet').toHaveCount(CATALONIA.rowCount);
	await expectScrolledToEnd(sheet);
	await expectFullyOnScreen(page, rows.last(), 'the last region row');
}

async function expectDishEndsOnScreen(page: Page) {
	await expectScrolledToEnd(dishSheet(page));
	await expectFullyOnScreen(page, seeAllLink(page, 'en'), 'the dish sheet’s last row (See all)');
}

test.describe('FB-5: the region sheet scrolls to an end on screen', () => {
	test.beforeEach(async ({ page }) => {
		skipOnDesktop(page);
		await gotoHydrated(page, `/${LANG}/regions/${CATALONIA.key}`);
	});

	test('in peek', { tag: ['@layout', '@cross-browser'] }, async ({ page }) => {
		await expectSheetPeek(page, CATALONIA.name);
		await expectRegionEndsOnScreen(page);
	});

	test('expanded', { tag: ['@layout', '@cross-browser'] }, async ({ page }) => {
		await expandSheet(regionSheet(page), LANG);
		await expectSheetExpanded(page, CATALONIA.name);
		await expectRegionEndsOnScreen(page);
	});
});

test.describe('FB-5: the Popular dish sheet scrolls to an end on screen', () => {
	test.beforeEach(async ({ page }) => {
		skipOnDesktop(page);
		await gotoHydrated(page, `/en/?tab=popular&dish=${TORTILLA.key}`);
	});

	test('in peek', { tag: '@layout' }, async ({ page }) => {
		await expectSheetPeek(page, TORTILLA.name);
		await expectDishEndsOnScreen(page);
	});

	test('expanded', { tag: '@layout' }, async ({ page }) => {
		await expandSheet(dishSheet(page), 'en');
		await expectSheetExpanded(page, TORTILLA.name);
		await expectDishEndsOnScreen(page);
	});
});

const lastRegionRow = (page: Page): Locator => regionSheet(page).locator(REGION_ROWS).last();

// Catalonia in peek, its body scrolled to the end; returns the body's
// scrollTop, which must be past 0 (the peek's end is below the screen).
async function scrolledPeek(page: Page): Promise<number> {
	await expectSheetPeek(page, CATALONIA.name);
	await expectScrolledToEnd(regionSheet(page));
	const top = await sheetBody(regionSheet(page)).evaluate((el) => el.scrollTop);
	expect(
		top,
		'got the peek body unscrollable (scrollTop 0), want its end reachable'
	).toBeGreaterThan(0);
	return top;
}

async function sampleRegionRow(page: Page) {
	await startSampling(sheetBody(regionSheet(page)), lastRegionRow(page));
}

test.describe('FB-5: changing state from a scrolled peek', () => {
	test.beforeEach(async ({ page }) => {
		skipOnDesktop(page);
		await gotoHydrated(page, `/${LANG}/regions/${CATALONIA.key}`);
	});

	test(
		'expanding keeps the last row on screen in every frame',
		{ tag: '@layout' },
		async ({ page }) => {
			await scrolledPeek(page);
			const screenBottom = await visualViewportBottom(page);
			await sampleRegionRow(page);
			await expandSheet(regionSheet(page), LANG);
			await expectSheetExpanded(page, CATALONIA.name);
			const samples = await stopSampling(page);
			expectRowNeverBelow(samples, screenBottom, 'the last region row');
		}
	);

	test(
		'hiding keeps the scroll offset while the sheet slides out',
		{ tag: '@layout' },
		async ({ page }) => {
			const start = await scrolledPeek(page);
			await sampleRegionRow(page);
			await tapScrim(page);
			await expectSheetHidden(page);
			expectScrollKept(await stopSampling(page), start);
		}
	);
});
