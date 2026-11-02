import { expect, test, type Locator, type Page } from '../testutil/e2e-test';
import { gotoHydrated, onlyVisible } from '../testutil/home-e2e';
import { RECIPE_TEST_IDS } from '../testutil/recipe-copy';
import { pageTitle, VARIATION_CARD_TEST_ID } from '../testutil/variations-copy';

// FE-9 FB-10 / D-FE9-6 (owner, 2026-11-02): a variation's title outside its
// dish page names the dish. Mobile README -> Region sheet row and Screen 3;
// desktop README -> region panel rows and Recipe page hero: the title is
// "{dish} · {variation}", or the variation name alone when it already starts
// with the dish name; the Recipe eyebrow is the region only; the Variations
// page keeps bare variation names (they sit under the dish heading there).
//
// Data is the mock bundle (and demo's seed). Croquetas' Valencian variation
// is "De sepia", the case FB-10 reported. The bundle has no variation whose
// name starts with its dish name (its dish names are categories such as
// "Arroces"), so that case is pinned by variation-title.spec.ts, the
// RegionDetails component spec and the Recipe page SSR spec instead.
//
// Untagged: the row check runs in the mobile sheet (390) and the desktop
// panel (1280), the only two containers; the text doesn't depend on width.

const LANG = 'es';
const REGION_PATH = `/${LANG}/regions/val`;
const RECIPE_PATH = `/${LANG}/dishes/croquetas/val`;
const DISH_PATH = `/${LANG}/dishes/croquetas`;
const REGION_NAME = 'Comunidad Valenciana';
const VARIATION_NAME = 'De sepia';
const FULL_TITLE = 'Croquetas · De sepia';

// The row link of the container the current layout shows (sheet or panel).
const visibleRow = (page: Page, href: string): Locator =>
	onlyVisible(page.locator(`a[href="${href}"]`));

test.describe('variation titles name their dish (es, De sepia)', () => {
	test(`${REGION_PATH}: the croquetas row is titled "${FULL_TITLE}"`, async ({ page }) => {
		await gotoHydrated(page, REGION_PATH);
		const row = visibleRow(page, RECIPE_PATH);
		await expect(row).toHaveCount(1);
		await expect(row.getByText(FULL_TITLE, { exact: true })).toBeVisible();
	});

	test(`${RECIPE_PATH}: eyebrow "${REGION_NAME}", <h1> and <title> "${FULL_TITLE}"`, async ({
		page
	}) => {
		await gotoHydrated(page, RECIPE_PATH);
		await expect(page.getByTestId(RECIPE_TEST_IDS.eyebrow)).toHaveText(REGION_NAME);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(FULL_TITLE);
		expect(await page.title()).toBe(pageTitle(FULL_TITLE));
	});

	test(`${DISH_PATH}: the Variations page keeps the bare name "${VARIATION_NAME}"`, async ({
		page
	}) => {
		await gotoHydrated(page, DISH_PATH);
		const card = page.locator(`[data-testid="${VARIATION_CARD_TEST_ID}"][href="${RECIPE_PATH}"]`);
		await expect(card).toHaveCount(1);
		await expect(card.getByText(VARIATION_NAME, { exact: true })).toBeVisible();
		await expect(card.getByText(FULL_TITLE)).toHaveCount(0);
	});
});
