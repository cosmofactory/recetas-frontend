import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { DESKTOP, expectPageSettled, MOBILE, skipUnlessLayout } from '../testutil/a11y-states-e2e';
import {
	expectDropdownClosed,
	focusDesktopSearch,
	searchDropdown
} from '../testutil/desktop-search-e2e';
import { gotoHydrated, pathAndQuery } from '../testutil/home-e2e';
import { expectMenuClosed, languageMenu, openMenu } from '../testutil/language-menu-e2e';
import {
	expectMovement,
	expectOnlyFades,
	recordAnimations,
	resetAnimationLog
} from '../testutil/motion-e2e';
import { dishCard, expectFiltersSheetClosed, openFiltersSheet } from '../testutil/popular-e2e';
import {
	expectSheetExpanded,
	expectSheetHidden,
	expectSheetPeek,
	GALICIA_EN,
	regionSheet,
	tapRegion
} from '../testutil/region-e2e';
import { openSearch, searchDialog } from '../testutil/search-e2e';
import { backLink } from '../testutil/variations-e2e';

// FE-8 Accessibility: "Reduced-motion emulation run" (both READMEs ->
// Accessibility: "Respect prefers-reduced-motion (swap slides for fades)").
// With reducedMotion: 'reduce', opening and closing every sheet and overlay
// and a page push / pop only fade: no recorded animation or transition moves
// a box (motion-e2e.ts), at least one fades, and once it is over the layer
// rests where it belongs (open: shown, opaque, at its resting position;
// closed: gone or hidden), never mid-way.

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
	await recordAnimations(page);
});

const OPAQUE = '1';

async function expectRestingOpen(layer: Locator, what: string) {
	await expect(layer, `want ${what} shown`).toBeVisible();
	await expectPageSettled(layer.page());
	const opacity = await layer.evaluate((el) => getComputedStyle(el).opacity);
	expect(opacity, `got ${what} at opacity ${opacity}, want it at rest`).toBe(OPAQUE);
}

async function expectPath(page: Page, want: string) {
	await expect.poll(() => pathAndQuery(page), { message: `want ${want}` }).toBe(want);
}

// Runs one change, waits for it to settle, then checks it only faded.
async function step(page: Page, what: string, change: () => Promise<void>) {
	await resetAnimationLog(page);
	await change();
	await expectPageSettled(page);
	await expectOnlyFades(page, what);
}

test.describe('reduced motion: sheets and overlays fade on mobile', () => {
	test('the region sheet: open, expand, close', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/');
		await step(page, 'opening the region sheet', async () => {
			await tapRegion(page, 'gal');
			await expectSheetPeek(page, GALICIA_EN.name);
		});
		await step(page, 'expanding the region sheet', async () => {
			await regionSheet(page).locator('button[aria-expanded]').click();
			await expectSheetExpanded(page, GALICIA_EN.name);
		});
		await step(page, 'closing the region sheet', async () => {
			await page.keyboard.press('Escape');
			await expectSheetHidden(page);
		});
	});

	test('the dish sheet: open, close', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/?tab=popular');
		await step(page, 'opening the dish sheet', async () => {
			await dishCard(page, 'tortilla').click();
			await expectSheetPeek(page, 'Tortilla de patatas');
		});
		await step(page, 'closing the dish sheet', async () => {
			await page.keyboard.press('Escape');
			await expectSheetHidden(page);
		});
	});

	test('the Filters sheet: open, close', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/?tab=popular');
		await step(page, 'opening the Filters sheet', () => openFiltersSheet(page, 'en'));
		await step(page, 'closing the Filters sheet', async () => {
			await page.keyboard.press('Escape');
			await expectFiltersSheetClosed(page, 'en');
		});
	});

	test('the search overlay: open, close', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/');
		await step(page, 'opening search', async () => {
			await openSearch(page, 'en');
			await expectRestingOpen(searchDialog(page, 'en'), 'the search overlay');
		});
		await step(page, 'closing search', async () => {
			await page.keyboard.press('Escape');
			await expect(searchDialog(page, 'en')).toBeHidden();
		});
	});

	test('a page push and pop', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/regions/gal');
		await step(page, 'pushing the recipe page', async () => {
			await regionSheet(page).locator('a[href="/en/dishes/tortilla/gal"]').click();
			await expectPath(page, '/en/dishes/tortilla/gal');
		});
		await step(page, 'going back from the recipe', async () => {
			await backLink(page, 'en').click();
			await expectPath(page, '/en/regions/gal');
			await expectSheetPeek(page, GALICIA_EN.name);
		});
	});
});

test.describe('reduced motion: menus and overlays fade on both layouts', () => {
	test('the language menu: open, close', { tag: ['@cross-browser'] }, async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await step(page, 'opening the language menu', async () => {
			await openMenu(page, 'en');
			await expectRestingOpen(languageMenu(page, 'en'), 'the language menu');
		});
		await step(page, 'closing the language menu', async () => {
			await page.keyboard.press('Escape');
			await expectMenuClosed(page, 'en');
		});
	});

	test(
		'the desktop search dropdown: open, close',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			skipUnlessLayout(page, DESKTOP);
			await gotoHydrated(page, '/en/');
			await step(page, 'opening the search dropdown', async () => {
				await focusDesktopSearch(page, 'en');
				await expectRestingOpen(searchDropdown(page), 'the search dropdown');
			});
			await step(page, 'closing the search dropdown', async () => {
				await page.keyboard.press('Escape');
				await expectDropdownClosed(page, 'en');
			});
		}
	);
});

// The recorder's positive controls: with motion allowed, each kind of
// motion the app runs is seen moving: a CSS transition (the language menu
// drops in, translateY −6px → 0; the region sheet slides up, BottomSheet's
// transform transition) and a view transition (the mobile page push,
// ::view-transition-new(root) translateX 102% → 0). The app has no Svelte
// (script) transitions; the recorder reads those through the same
// document.getAnimations().
test.describe('without reduced motion the recorder sees the slides', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the language menu slides in', { tag: ['@cross-browser'] }, async ({ page }) => {
		await gotoHydrated(page, '/en/');
		await resetAnimationLog(page);
		await openMenu(page, 'en');
		await expectPageSettled(page);
		await expectMovement(page, 'opening the language menu');
	});

	test('the region sheet slides up', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/');
		await resetAnimationLog(page);
		await tapRegion(page, 'gal');
		await expectSheetPeek(page, GALICIA_EN.name);
		await expectPageSettled(page);
		await expectMovement(page, 'opening the region sheet');
	});

	test('a page push slides in', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await gotoHydrated(page, '/en/regions/gal');
		await resetAnimationLog(page);
		await regionSheet(page).locator('a[href="/en/dishes/tortilla/gal"]').click();
		await expectPath(page, '/en/dishes/tortilla/gal');
		await expectPageSettled(page);
		await expectMovement(page, 'pushing the recipe page', 'view-transition');
	});
});
