import { expect, test, type Locator, type Page } from '@playwright/test';
import { isDesktopPage, onlyVisible } from './home-e2e';
import {
	FILTERS_ACTIVE_ATTR,
	filtersLabel,
	POPULAR_COPY,
	SHEET_COPY,
	TEST_IDS,
	type FilterIdCopy,
	type GroupKey,
	type PopularLocale,
	type QuickId
} from './popular-copy';
import { regionSheet } from './region-e2e';

// Shared fixtures for the FE-5 Popular tab Playwright specs. Content is the
// vendored mock bundle (DATA_SOURCE=mock); copy is in popular-copy.ts.

export const POPULAR_PANEL = '#home-popular';

export function skipOnMobile(page: Page, why = 'the desktop Popular layout (≥ 860px)') {
	test.skip(!isDesktopPage(page), why);
}

export function skipOnDesktop(
	page: Page,
	why = 'the mobile Popular layout (desktop is FE-5 PR 3)'
) {
	test.skip(isDesktopPage(page), why);
}

export const popularPanel = (page: Page): Locator => page.locator(POPULAR_PANEL);

export const filterBar = (page: Page): Locator => onlyVisible(page.getByTestId(TEST_IDS.filterBar));

export const filtersButton = (page: Page): Locator => filterBar(page).getByRole('button').first();

export function quickChip(page: Page, lang: PopularLocale, id: QuickId): Locator {
	const name = POPULAR_COPY[lang].quick[id];
	return filterBar(page).getByRole('button', { name, exact: true });
}

export const dishCards = (page: Page): Locator => popularPanel(page).getByTestId(TEST_IDS.dishCard);

export const resultCount = (page: Page): Locator =>
	onlyVisible(page.getByTestId(TEST_IDS.resultCount));

export const noMatch = (page: Page): Locator => popularPanel(page).getByTestId(TEST_IDS.noMatch);

// A card's dish key, from either of its hrefs (FE-5 PR 3): the mobile dish
// sheet URL (?dish=<key>) or the desktop Variations page (/:lang/dishes/<key>).
function dishKeyOf(href: string): string {
	const url = new URL(href, 'http://x');
	const fromSheet = url.searchParams.get('dish');
	if (fromSheet) return fromSheet;
	return /^\/[a-z]{2}\/dishes\/([^/]+)$/.exec(url.pathname)?.[1] ?? `(no dish in ${href})`;
}

// The dish keys the list shows, read from each card's link.
export async function shownDishKeys(page: Page): Promise<string[]> {
	const hrefs = await dishCards(page).evaluateAll((cards) =>
		cards.map((card) => card.getAttribute('href') ?? '')
	);
	return hrefs.map(dishKeyOf);
}

export async function expectDishes(page: Page, want: readonly string[], what: string) {
	await expect
		.poll(() => shownDishKeys(page), { message: `${what}: dish keys` })
		.toEqual([...want]);
}

export async function expectFiltersButton(page: Page, lang: PopularLocale, count: number) {
	const button = filtersButton(page);
	await expect(button).toHaveText(filtersLabel(lang, count));
	const isActive = async () => (await button.getAttribute(FILTERS_ACTIVE_ATTR)) === 'true';
	await expect
		.poll(isActive, { message: `want ${FILTERS_ACTIVE_ATTR}="true" exactly when N > 0` })
		.toBe(count > 0);
}

export async function pressedChips(page: Page, lang: PopularLocale, ids: readonly QuickId[]) {
	const pressed: QuickId[] = [];
	for (const id of ids) {
		if ((await quickChip(page, lang, id).getAttribute('aria-pressed')) === 'true') pressed.push(id);
	}
	return pressed;
}

// The closest scrolling ancestor of the first card (the list's own
// scroller): its sizes and offset, after scrolling it to `scrollTop` when given.
function measureScroller(page: Page, scrollTop?: number) {
	return dishCards(page)
		.first()
		.evaluate((card, top) => {
			let el = card.parentElement;
			while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
			if (el && top !== undefined) el.scrollTop = top;
			return el
				? {
						found: true,
						scrollHeight: el.scrollHeight,
						clientHeight: el.clientHeight,
						scrollTop: el.scrollTop
					}
				: { found: false, scrollHeight: 0, clientHeight: 0, scrollTop: 0 };
		}, scrollTop);
}

export const listScroller = (page: Page) => measureScroller(page);

const SCROLL_PAST_END = 100_000;

export const scrollListToEnd = (page: Page) => measureScroller(page, SCROLL_PAST_END);

// FE-5 PR 2: the Filters sheet (OverlaySheet: a dialog named "Filters") and
// the dish sheet (BottomSheet: the one [role="dialog"][data-state] on the
// Popular tab, named by the dish).

export function filtersSheet(page: Page, lang: PopularLocale): Locator {
	return page.getByRole('dialog', { name: POPULAR_COPY[lang].filters, exact: true });
}

export function sheetGroup(page: Page, lang: PopularLocale, key: GroupKey): Locator {
	const name = SHEET_COPY[lang].groups[key];
	return filtersSheet(page, lang).getByRole('group', { name, exact: true });
}

export function sheetChip(page: Page, lang: PopularLocale, id: FilterIdCopy): Locator {
	const name = SHEET_COPY[lang].labels[id];
	return filtersSheet(page, lang).getByRole('button', { name, exact: true });
}

export function clearAllInSheet(page: Page, lang: PopularLocale): Locator {
	const name = POPULAR_COPY[lang].clearAll;
	const sheet = filtersSheet(page, lang);
	return sheet
		.getByRole('button', { name, exact: true })
		.or(sheet.getByRole('link', { name, exact: true }));
}

export function showResults(page: Page, lang: PopularLocale): Locator {
	const name = SHEET_COPY[lang].showResults;
	return filtersSheet(page, lang).getByRole('button', { name, exact: true });
}

export async function openFiltersSheet(page: Page, lang: PopularLocale) {
	await filtersButton(page).click();
	await expectFiltersSheetOpen(page, lang);
}

// By keyboard: works with a dish sheet's scrim over the filter bar.
export async function openFiltersSheetByKeyboard(page: Page, lang: PopularLocale) {
	await filtersButton(page).focus();
	await page.keyboard.press('Enter');
	await expectFiltersSheetOpen(page, lang);
}

const REST_TOLERANCE_PX = 1;

// Whether the open sheet has come to rest: no transition or animation still
// running on it, and its bottom edge on the frame's bottom (translateY 0).
function sheetAtRest(sheet: Locator): Promise<boolean> {
	return sheet.evaluate((el, tolerance) => {
		const settled = el.getAnimations().every((a) => a.playState !== 'running');
		const bottom = el.getBoundingClientRect().bottom;
		return settled && Math.abs(bottom - window.innerHeight) <= tolerance;
	}, REST_TOLERANCE_PX);
}

// Open and settled: geometry read after this is the resting layout, not a
// frame of the 400ms slide (--dur-filter).
export async function expectFiltersSheetOpen(page: Page, lang: PopularLocale) {
	const sheet = filtersSheet(page, lang);
	await expect(sheet).toBeVisible();
	await expect(sheet).toHaveAttribute('aria-modal', 'true');
	await expect(filtersButton(page)).toHaveAttribute('aria-expanded', 'true');
	await expect
		.poll(() => sheetAtRest(sheet), {
			message: 'want the Filters sheet at rest on the frame bottom'
		})
		.toBe(true);
}

export async function expectFiltersSheetClosed(page: Page, lang: PopularLocale) {
	await expect(filtersSheet(page, lang)).toHaveCount(0);
	await expect(filtersButton(page)).toHaveAttribute('aria-expanded', 'false');
}

export async function sheetPressedIds(
	page: Page,
	lang: PopularLocale,
	ids: readonly FilterIdCopy[]
): Promise<FilterIdCopy[]> {
	const pressed: FilterIdCopy[] = [];
	for (const id of ids) {
		if ((await sheetChip(page, lang, id).getAttribute('aria-pressed')) === 'true') pressed.push(id);
	}
	return pressed;
}

export const dishSheet = regionSheet;

export function dishCard(page: Page, key: string): Locator {
	const card = `[data-testid="${TEST_IDS.dishCard}"]`;
	return popularPanel(page).locator(
		`${card}[href$="dish=${key}"], ${card}[href$="/dishes/${key}"]`
	);
}

// The dish sheet's variation rows (links into a recipe), in DOM order.
export async function sheetRowHrefs(page: Page): Promise<string[]> {
	const hrefs = await dishSheet(page)
		.locator('a[href]')
		.evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
	return hrefs.filter((href) => /\/dishes\/[^/]+\/[^/]+$/.test(href));
}

export function seeAllLink(page: Page, lang: PopularLocale): Locator {
	return dishSheet(page).getByRole('link', { name: SHEET_COPY[lang].seeAll, exact: true });
}

// Taps the scrim at the top of the screen frame, above any open sheet.
export async function tapTopScrim(page: Page) {
	const width = page.viewportSize()?.width ?? 0;
	await page.mouse.click(width / 2, 8);
}

export async function focusIsIn(container: Locator): Promise<boolean> {
	return container.evaluate((el) => el.contains(document.activeElement));
}

// FE-5 PR 3: the desktop filter sidebar (≥ 860px), a region named by its
// "Filters" heading, holding FilterGroups and its own "Clear all" button.

export const filterSidebar = (page: Page): Locator =>
	onlyVisible(page.getByTestId(TEST_IDS.filterSidebar));

export function sidebarChip(page: Page, lang: PopularLocale, id: FilterIdCopy): Locator {
	const name = SHEET_COPY[lang].labels[id];
	return filterSidebar(page).getByRole('button', { name, exact: true });
}

export function sidebarGroup(page: Page, lang: PopularLocale, key: GroupKey): Locator {
	const name = SHEET_COPY[lang].groups[key];
	return filterSidebar(page).getByRole('group', { name, exact: true });
}

export function clearAllInSidebar(page: Page, lang: PopularLocale): Locator {
	const name = POPULAR_COPY[lang].clearAll;
	return filterSidebar(page).getByRole('button', { name, exact: true });
}

export async function sidebarPressedIds(
	page: Page,
	lang: PopularLocale,
	ids: readonly FilterIdCopy[]
): Promise<FilterIdCopy[]> {
	const pressed: FilterIdCopy[] = [];
	for (const id of ids) {
		if ((await sidebarChip(page, lang, id).getAttribute('aria-pressed')) === 'true')
			pressed.push(id);
	}
	return pressed;
}

export async function cardHrefs(page: Page): Promise<string[]> {
	return dishCards(page).evaluateAll((cards) => cards.map((c) => c.getAttribute('href') ?? ''));
}
