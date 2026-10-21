import { expect, test, type Locator, type Page } from '@playwright/test';
import { isDesktopPage, onlyVisible } from './home-e2e';
import {
	FILTERS_ACTIVE_ATTR,
	filtersLabel,
	POPULAR_COPY,
	TEST_IDS,
	type PopularLocale,
	type QuickId
} from './popular-copy';

// Shared fixtures for the FE-5 Popular tab Playwright specs. Content is the
// vendored mock bundle (DATA_SOURCE=mock); copy is in popular-copy.ts.

export const POPULAR_PANEL = '#home-popular';

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

// The dish keys the list shows, read from each card's ?dish= link.
export async function shownDishKeys(page: Page): Promise<string[]> {
	const hrefs = await dishCards(page).evaluateAll((cards) =>
		cards.map((card) => card.getAttribute('href') ?? '')
	);
	return hrefs.map(
		(href) => new URL(href, 'http://x').searchParams.get('dish') ?? `(no dish in ${href})`
	);
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
// scroller): its sizes, after scrolling it to `scrollTop` when given.
function measureScroller(page: Page, scrollTop?: number) {
	return dishCards(page)
		.first()
		.evaluate((card, top) => {
			let el = card.parentElement;
			while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
			if (el && top !== undefined) el.scrollTop = top;
			return el
				? { found: true, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
				: { found: false, scrollHeight: 0, clientHeight: 0 };
		}, scrollTop);
}

export const listScroller = (page: Page) => measureScroller(page);

const SCROLL_PAST_END = 100_000;

export const scrollListToEnd = (page: Page) => measureScroller(page, SCROLL_PAST_END);
