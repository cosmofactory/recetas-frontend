import { expect, type Locator, type Page } from '@playwright/test';
import { boxOf, onlyVisible, type Box } from './home-e2e';
import { DROPDOWN_TEST_ID, RESULT_TEST_IDS, SEARCH_COPY, type SearchLocale } from './search-copy';

// Shared fixtures for the FE-7 PR 4 desktop inline search Playwright spec
// (≥ 860px). Content is the vendored mock bundle (DATA_SOURCE=mock).

// The top bar the current layout shows (the desktop <header>, a banner).
const visibleBanner = (page: Page): Locator => onlyVisible(page.getByRole('banner'));

export const desktopSearchInput = (page: Page, lang: SearchLocale): Locator =>
	visibleBanner(page).getByRole('combobox', { name: SEARCH_COPY[lang].dialog, exact: true });

// The pill around the input (SearchField's test id).
export const desktopSearchField = (page: Page): Locator =>
	visibleBanner(page).getByTestId(RESULT_TEST_IDS.field);

export const searchDropdown = (page: Page): Locator => page.getByTestId(DROPDOWN_TEST_ID);

export function dropdownGroup(page: Page, lang: SearchLocale, index: 0 | 1 | 2): Locator {
	const name = SEARCH_COPY[lang].groups[index];
	return searchDropdown(page).getByRole('group', { name, exact: true });
}

// The option in a group whose text includes `title`.
export const dropdownOption = (group: Locator, title: string): Locator =>
	group.getByRole('option').filter({ hasText: title }).first();

export async function focusDesktopSearch(page: Page, lang: SearchLocale) {
	const input = desktopSearchInput(page, lang);
	await expect(input, 'want the search field in the desktop top bar').toBeVisible();
	await input.click();
	await expect(desktopSearchInput(page, lang)).toBeFocused();
	await expect(searchDropdown(page)).toBeVisible();
}

export async function typeInDesktopSearch(page: Page, lang: SearchLocale, query: string) {
	await focusDesktopSearch(page, lang);
	await desktopSearchInput(page, lang).fill(query);
}

export async function expectDropdownClosed(page: Page, lang: SearchLocale) {
	await expect(searchDropdown(page)).toBeHidden();
	await expect(desktopSearchInput(page, lang)).toHaveAttribute('aria-expanded', 'false');
}

export const fieldBox = (page: Page): Promise<Box> =>
	boxOf(desktopSearchField(page), 'the desktop search field');

export const dropdownBox = (page: Page): Promise<Box> =>
	boxOf(searchDropdown(page), 'the search dropdown');
