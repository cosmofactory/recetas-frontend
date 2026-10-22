import { expect, type Locator, type Page } from '@playwright/test';
import { HOME_COPY, onlyVisible, tab } from './home-e2e';
import { SEARCH_COPY, type SearchLocale } from './search-copy';

// Shared fixtures for the FE-7 PR 2 mobile search overlay Playwright spec.
// Content is the vendored mock bundle (DATA_SOURCE=mock).

export const searchButton = (page: Page, lang: SearchLocale): Locator =>
	onlyVisible(page.getByRole('button', { name: HOME_COPY[lang].search, exact: true }));

export const searchDialog = (page: Page, lang: SearchLocale): Locator =>
	page.getByRole('dialog', { name: SEARCH_COPY[lang].dialog, exact: true });

export const searchInput = (page: Page, lang: SearchLocale): Locator =>
	searchDialog(page, lang).getByRole('combobox');

export function resultGroup(page: Page, lang: SearchLocale, index: 0 | 1 | 2): Locator {
	const name = SEARCH_COPY[lang].groups[index];
	return searchDialog(page, lang).getByRole('group', { name, exact: true });
}

// The option in a group whose text includes `title` (an option's name is its
// title plus subtitle).
export const resultOption = (group: Locator, title: string): Locator =>
	group.getByRole('option').filter({ hasText: title }).first();

export const DISHES = 0;
export const VARIATIONS = 1;
export const REGIONS = 2;

export async function openSearch(page: Page, lang: SearchLocale) {
	await searchButton(page, lang).click();
	await expect(searchDialog(page, lang)).toBeVisible();
	await expect(searchInput(page, lang)).toBeFocused();
}

export async function searchFor(page: Page, lang: SearchLocale, query: string) {
	await openSearch(page, lang);
	await searchInput(page, lang).fill(query);
}

export async function expectSelectedTab(
	page: Page,
	lang: SearchLocale,
	which: 'regional' | 'popular'
) {
	const name = HOME_COPY[lang][which];
	await expect(onlyVisible(tab(page, name))).toHaveAttribute('aria-selected', 'true');
}

// Every URL the main frame commits to, so a test can tell the query never
// reached one.
export function recordUrls(page: Page): string[] {
	const urls: string[] = [];
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) urls.push(frame.url());
	});
	return urls;
}
