import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { DESKTOP, expectPageSettled, MOBILE, skipUnlessLayout } from '../testutil/a11y-states-e2e';
import { backPill } from '../testutil/desktop-pages-e2e';
import { desktopSearchInput, searchDropdown } from '../testutil/desktop-search-e2e';
import { gotoHydrated, onlyVisible, pathAndQuery, tab } from '../testutil/home-e2e';
import {
	expectFocusAtDocumentStart,
	expectFocused,
	expectVisibleFocus,
	leaveWithEnter,
	press,
	tabTo
} from '../testutil/keyboard-e2e';
import { languageButton, languageMenu, menuRow } from '../testutil/language-menu-e2e';
import {
	clearAllInSheet,
	clearAllInSidebar,
	expectFiltersSheetClosed,
	expectFiltersSheetOpen,
	filtersButton,
	quickChip,
	sidebarChip
} from '../testutil/popular-e2e';
import { expectSheetPeek, regionLink, regionPanel, regionSheet } from '../testutil/region-e2e';
import { searchButton, searchDialog, searchInput } from '../testutil/search-e2e';
import { backLink } from '../testutil/variations-e2e';

// FE-8 Accessibility: "A keyboard-only e2e path through the whole flow:
// home → region → recipe → back; search; language switch; filters", once per
// layout, with keys only. After every key the focus is visible (an element,
// :focus-visible, a non-zero ring) and never on <body>; the one allowance is
// right after a full navigation (Kit's default focus reset, a reload),
// which starts the document over like a fresh load (assumption, see the
// FE-8 PR 5a report). Content is the vendored mock bundle.

const RECIPE = '/en/dishes/tortilla/gal';
const GALICIA = 'Galicia';

async function expectPath(page: Page, want: string) {
	await expect.poll(() => pathAndQuery(page), { message: `want ${want}` }).toBe(want);
}

// Enter on the focused link or result, then the new page at rest (no page
// push still running), with focus at the document start or on a visible control.
async function followTo(page: Page, want: string, step: string) {
	await leaveWithEnter(page, step);
	await expectPath(page, want);
	await expectPageSettled(page);
	await expectFocusAtDocumentStart(page, step);
}

// Map → region: the region link keeps focus (reset: false, FE-4).
async function mapToRegion(page: Page) {
	await gotoHydrated(page, '/en/');
	const galicia = regionLink(page, 'gal');
	await tabTo(page, galicia, 'the Galicia map region');
	await press(page, 'Enter', 'opening Galicia');
	await expectPath(page, '/en/regions/gal');
	await expectFocused(galicia, 'the Galicia map region');
}

// Region → its Betanzos recipe → back (the link, or the desktop pill).
async function recipeAndBack(page: Page, rows: Locator, back: Locator) {
	await tabTo(page, rows.locator(`a[href="${RECIPE}"]`), 'the Betanzos recipe row');
	await followTo(page, RECIPE, 'opening the recipe');
	await tabTo(page, back, 'the recipe back link');
	await followTo(page, '/en/regions/gal', 'going back');
}

// Typing goes to the focused combobox; the arrow makes the first result
// active (focus stays in the field, aria-activedescendant moves).
async function pickFirstResult(page: Page) {
	await page.keyboard.type('tortilla');
	await press(page, 'ArrowDown', 'activating the first result');
	await followTo(page, '/en/dishes/tortilla', 'opening the dish');
}

async function openMobileSearch(page: Page) {
	await tabTo(page, searchButton(page, 'en'), 'the search button');
	await page.keyboard.press('Enter');
	await expect(searchDialog(page, 'en')).toBeVisible();
	await expectFocused(searchInput(page, 'en'), 'the search field');
	await expectVisibleFocus(page, 'opening search');
}

async function switchToSpanish(page: Page, want: string) {
	await tabTo(page, languageButton(page, 'en'), 'the language button');
	await press(page, 'Enter', 'opening the language menu');
	await expect(languageMenu(page, 'en')).toBeVisible();
	await press(page, 'ArrowDown', 'moving to Español');
	await expectFocused(menuRow(page, 'en', 'es'), 'the Español row');
	await followTo(page, want, 'the language switch');
}

// Space toggles the Vegetariano chip on; focus stays on it.
async function toggleVegetarian(page: Page, chip: Locator) {
	await tabTo(page, chip, 'the Vegetariano chip');
	await press(page, 'Space', 'toggling Vegetariano');
	await expectPath(page, '/es/?tab=popular&f=vegetarian');
	await expectFocused(chip, 'the Vegetariano chip');
}

async function clearInFiltersSheet(page: Page) {
	await tabTo(page, filtersButton(page), 'the Filters button', 'Shift+Tab');
	await press(page, 'Enter', 'opening the Filters sheet');
	await expectFiltersSheetOpen(page, 'es');
	await tabTo(page, clearAllInSheet(page, 'es'), 'Clear all in the sheet');
	await press(page, 'Enter', 'clearing the filters');
	await expectPath(page, '/es/?tab=popular');
	await press(page, 'Escape', 'closing the Filters sheet');
	await expectFiltersSheetClosed(page, 'es');
	await expectFocused(filtersButton(page), 'the Filters button');
}

async function clearInSidebar(page: Page) {
	const clearAll = clearAllInSidebar(page, 'es');
	await tabTo(page, clearAll, 'Clear all', 'Shift+Tab');
	await press(page, 'Enter', 'clearing the filters');
	await expectPath(page, '/es/?tab=popular');
	await expectFocused(clearAll, 'Clear all');
}

test.describe('keyboard only: the whole flow on mobile', () => {
	test('region, recipe, back, search, language, filters', async ({ page }) => {
		skipUnlessLayout(page, MOBILE);
		await mapToRegion(page);
		await expectSheetPeek(page, GALICIA);
		await recipeAndBack(page, regionSheet(page), backLink(page, 'en'));

		await openMobileSearch(page);
		await pickFirstResult(page);
		await tabTo(page, backLink(page, 'en'), 'the Variations back link');
		await followTo(page, '/en/?tab=popular', 'going back to Popular');

		await switchToSpanish(page, '/es/?tab=popular');
		await toggleVegetarian(page, quickChip(page, 'es', 'vegetarian'));
		await clearInFiltersSheet(page);
	});
});

test.describe('keyboard only: the whole flow on desktop', () => {
	test(
		'region, recipe, back, search, language, filters',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			skipUnlessLayout(page, DESKTOP);
			await mapToRegion(page);
			await expect(regionPanel(page, GALICIA)).toBeVisible();
			await recipeAndBack(page, regionPanel(page, GALICIA), backPill(page));

			await tabTo(page, desktopSearchInput(page, 'en'), 'the search field');
			await expect(searchDropdown(page)).toBeVisible();
			await pickFirstResult(page);

			await switchToSpanish(page, '/es/dishes/tortilla');
			await tabTo(page, onlyVisible(tab(page, 'Popular')), 'the Popular tab');
			await followTo(page, '/es/?tab=popular', 'opening Popular');
			await toggleVegetarian(page, sidebarChip(page, 'es', 'vegetarian'));
			await clearInSidebar(page);
		}
	);
});
