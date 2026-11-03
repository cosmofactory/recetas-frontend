import { expect, test, type Page } from '../testutil/e2e-test';
import { skipUnlessLayout } from '../testutil/a11y-states-e2e';
import { gotoHydrated, pathAndQuery } from '../testutil/home-e2e';
import { expectMapSelection } from '../testutil/map-dim-e2e';
import { activateRegion, clickRegionCell, tapRegion } from '../testutil/region-e2e';

// FE-9 FB-4, spec change D-FE9-3 (owner, 2026-11-01): the selected map
// region no longer turns near-black.
//
// Sources: mobile README -> Map (shared): "while a region is selected, it
// keeps its tileColor and every other region's cells drop to
// --region-dimmed-opacity (labels and their chips are not dimmed)". Desktop
// README -> Regional: "Selected: the region keeps its tileColor while every
// other region's cells drop to --region-dimmed-opacity (labels not dimmed),
// 200ms". Stage FE-9 -> FB-4: "No selection: every region at full colour.
// Mobile and desktop (shared map)."
//
// Selection (FE-4; FE-9 FB-13, D-FE9-8): both layouts select nothing on
// /:lang/ and the region of /:lang/regions/:key (tap, keyboard or deep link);
// on desktop clicking the selected region again, or Escape, clears it to
// /:lang/. The no-JavaScript render is in home-region.e2e.ts. Transition timing and reduced
// motion are pinned in RegionMap.svelte.spec.ts.

// A failed clear reads as an assertion, not a navigation timeout.
async function expectBareHome(page: Page) {
	await expect
		.poll(() => pathAndQuery(page), { message: 'want the region cleared to /en/' })
		.toBe('/en/');
}

test.describe('map dimming on mobile', () => {
	test.beforeEach(({ page }) => skipUnlessLayout(page, ['mobile']));

	test(
		'/en/ before any tap: every region at full colour and opacity',
		{ tag: '@layout' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await expectMapSelection(page, null);
		}
	);

	test('tap Galicia: Galicia keeps its colour, every other region is dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectMapSelection(page, 'gal');
	});

	test('deep link /en/regions/gal: Galicia selected, the rest dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectMapSelection(page, 'gal');
	});

	test('from Galicia, activating Canarias moves the dimming', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await activateRegion(page, 'can');
		await expectMapSelection(page, 'can');
	});

	test('Back from a region to /en/: no region dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectMapSelection(page, null);
	});
});

test.describe('map dimming on desktop', () => {
	test.beforeEach(({ page }) => skipUnlessLayout(page, ['desktop']));

	test(
		'/en/ on first load: every region at full colour and opacity (D-FE9-8)',
		{ tag: '@layout' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await expectMapSelection(page, null);
		}
	);

	test('click Galicia: Galicia keeps its colour, every other region is dimmed', async ({
		page
	}) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectMapSelection(page, 'gal');
	});

	test('deep link /en/regions/gal: Galicia selected, the rest dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await expectMapSelection(page, 'gal');
	});

	test('click Galicia again: nothing dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await expectMapSelection(page, 'gal');
		await clickRegionCell(page, 'gal');
		await expectBareHome(page);
		await expectMapSelection(page, null);
	});

	test('Escape on Galicia: nothing dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/regions/gal');
		await page.keyboard.press('Escape');
		await expectBareHome(page);
		await expectMapSelection(page, null);
	});

	test('Back from a region to /en/: no region dimmed', async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await tapRegion(page, 'gal');
		await page.goBack();
		await page.waitForURL((url) => url.pathname === '/en/');
		await expectMapSelection(page, null);
	});
});
