import mapGrid from '../lib/map/map-grid.json' with { type: 'json' };
import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { LOCALES, type Locale } from '../testutil/e2e';
import { bottom, boxOf, gotoHydrated, isDesktopPage, visibleMap } from '../testutil/home-e2e';
import { mapRegions, REGION_COUNT, type MapRegionCopy } from '../testutil/map-regions-e2e';
import {
	expectSheetHidden,
	expectSheetPeek,
	historyLength,
	regionLink,
	selectedRegions,
	tapRegion
} from '../testutil/region-e2e';

// D-REG-1 (owner, 2026-11-23), the mobile region chip row. Mobile README ->
// Regional tab — body: "Region chips, directly under the map: one
// horizontally scrolling chip row (the same chip style as the Popular filter
// bar, full 44px hit area) with all 17 regions in map order, each labelled
// with the region name. Tapping a chip does exactly what tapping the region
// on the map does (selects it and opens the sheet at peek); the selected
// region's chip shows the active chip style. The row doesn't wrap; no "all"
// chip." Accessibility: map tiles are exempt from 44px; "the region chips
// under the map are their full-size equivalent" (the 44px check itself is
// a11y-hit-area.e2e.ts). Desktop has no chip row (its panel's empty state
// lists the regions).
//
// Assumed hooks (see RegionChips.svelte.spec.ts): the row is
// data-testid="region-chips"; each chip is a link to /:lang/regions/:key;
// the selected one carries aria-current="true".

const CHIPS_TEST_ID = 'region-chips';
const REGION_ORDER = (mapGrid as { regionOrder?: string[] }).regionOrder ?? [];
// "directly under the map": the body's column gap at most (prototype gap 10px).
const MAX_MAP_TO_CHIPS_PX = 16;

function skipUnlessMobile(page: Page) {
	test.skip(isDesktopPage(page), 'the region chip row is mobile only (< 860px)');
}

function regionChips(page: Page): Locator {
	return page.getByTestId(CHIPS_TEST_ID);
}

function chip(page: Page, key: string, lang: Locale = 'en'): Locator {
	return regionChips(page).locator(`a[href="/${lang}/regions/${key}"]`);
}

async function chipTexts(page: Page): Promise<{ key: string; text: string }[]> {
	return regionChips(page)
		.locator('a[href]')
		.evaluateAll((links) =>
			links.map((link) => ({
				key: (link.getAttribute('href') ?? '').split('/').pop() ?? '',
				text: (link.textContent ?? '').replace(/\s+/g, ' ').trim()
			}))
		);
}

function regionOf(lang: Locale, key: string): MapRegionCopy {
	const region = mapRegions(lang).find((r) => r.key === key);
	expect(region, `got no region ${key} in the mock bundle`).toBeDefined();
	return region!;
}

// The state a map tap leaves: the region URL, its sheet in peek, it alone
// selected on the map and among the chips.
async function expectRegionOpen(page: Page, lang: Locale, key: string) {
	await page.waitForURL((url) => url.pathname === `/${lang}/regions/${key}`);
	await expectSheetPeek(page, regionOf(lang, key).name);
	await expect(regionLink(page, key, lang)).toHaveAttribute('aria-current', 'true');
	await expect(selectedRegions(page)).toHaveCount(1);
	await expect(chip(page, key, lang)).toHaveAttribute('aria-current', 'true');
	await expect(regionChips(page).locator('a[aria-current]')).toHaveCount(1);
}

test.describe('mobile region chips (D-REG-1)', () => {
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	for (const lang of LOCALES) {
		test(`/${lang}/: all ${REGION_COUNT} regions by name, in map order`, async ({ page }) => {
			await gotoHydrated(page, `/${lang}/`);
			await expect(regionChips(page)).toBeVisible();
			const want = REGION_ORDER.map((key) => ({ key, text: regionOf(lang, key).name }));
			expect(await chipTexts(page)).toEqual(want);
			expect(want, 'want the 17 regions of regionOrder').toHaveLength(REGION_COUNT);
		});
	}

	test(
		'/en/: one non-wrapping row directly under the map that scrolls sideways',
		{ tag: '@layout' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			const map = await boxOf(visibleMap(page), 'map');
			const row = await boxOf(regionChips(page), 'region chips');
			const gap = row.y - bottom(map);
			expect(gap, `got ${gap}px from the map to the chips`).toBeGreaterThanOrEqual(0);
			expect(gap, `got ${gap}px from the map to the chips`).toBeLessThanOrEqual(
				MAX_MAP_TO_CHIPS_PX
			);
			const tops = await regionChips(page)
				.locator('a[href]')
				.evaluateAll(
					(links) => new Set(links.map((l) => Math.round(l.getBoundingClientRect().top))).size
				);
			expect(tops, `got chips on ${tops} lines`).toBe(1);
			const scrolls = await regionChips(page)
				.locator('a[href]')
				.first()
				.evaluate((first) => first.parentElement!.scrollWidth > first.parentElement!.clientWidth);
			expect(scrolls, 'want the row to scroll sideways').toBe(true);
		}
	);

	// La Rioja: the smallest map region (about 42×20px at 390px).
	for (const key of ['rio', 'and', 'can']) {
		test(`/en/: tapping the ${key} chip opens it like a map tap; Back returns home`, async ({
			page
		}) => {
			await gotoHydrated(page, '/en/');
			const entries = await historyLength(page);
			await chip(page, key).click();
			await expectRegionOpen(page, 'en', key);
			expect(await historyLength(page), 'want one new history entry, as a map tap').toBe(
				entries + 1
			);
			await page.goBack();
			await page.waitForURL((url) => url.pathname === '/en/');
			await expectSheetHidden(page);
			await expect(regionChips(page).locator('a[aria-current]')).toHaveCount(0);
		});
	}

	test('/en/: a map tap marks the region’s chip active', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectRegionOpen(page, 'en', 'gal');
	});

	// The peek's scrim covers the chips as it covers the map, so switching is
	// by keyboard, as home-region's "another region (keyboard)" does for the map.
	test('/ru/: a chip (keyboard) switches regions with the sheet kept in peek', async ({ page }) => {
		await gotoHydrated(page, '/ru/regions/gal');
		await expectRegionOpen(page, 'ru', 'gal');
		await chip(page, 'cnb', 'ru').focus();
		await page.keyboard.press('Enter');
		await expectRegionOpen(page, 'ru', 'cnb');
	});

	test('/en/: Enter on a chip opens the region; Escape closes it and focus returns to the chip', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/');
		await chip(page, 'nav').focus();
		await page.keyboard.press('Enter');
		await expectRegionOpen(page, 'en', 'nav');
		await page.keyboard.press('Escape');
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectSheetHidden(page);
		await expect(chip(page, 'nav'), 'want focus back on the Navarra chip').toBeFocused();
	});
});

test.describe('mobile region chips without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test.beforeEach(({ page }) => skipUnlessMobile(page));

	test('/en/: a chip is a link that opens its region page', async ({ page }) => {
		await page.goto('/en/');
		await chip(page, 'rio').click();
		await page.waitForURL((url) => url.pathname === '/en/regions/rio');
		await expect(chip(page, 'rio')).toHaveAttribute('aria-current', 'true');
	});
});

test.describe('desktop has no region chip row (D-REG-1)', () => {
	test.beforeEach(({ page }) => test.skip(!isDesktopPage(page), 'desktop layout (≥ 860px)'));

	for (const path of ['/en/', '/en/regions/rio']) {
		test(`${path}: the region chip row is not shown`, async ({ page }) => {
			await gotoHydrated(page, path);
			await expect(regionChips(page)).toBeHidden();
		});
	}
});
