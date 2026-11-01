import { test } from '../testutil/e2e-test';
import { skipUnlessLayout } from '../testutil/a11y-states-e2e';
import { gotoHydrated } from '../testutil/home-e2e';
import { expectMapSelection } from '../testutil/map-dim-e2e';
import { activateRegion, tapRegion } from '../testutil/region-e2e';

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
// Selection per layout (FE-4): mobile selects nothing on /:lang/ and the
// region of /:lang/regions/:key (tap, keyboard or deep link); desktop selects
// Andalucía on /:lang/ and the URL's region otherwise. The no-JavaScript
// desktop default is in home-region.e2e.ts. Transition timing and reduced
// motion are pinned in RegionMap.svelte.spec.ts.

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
		'/en/: the default Andalucía keeps its colour, every other region is dimmed',
		{ tag: '@layout' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			await expectMapSelection(page, 'and');
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
});
