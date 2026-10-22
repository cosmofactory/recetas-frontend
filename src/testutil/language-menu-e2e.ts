import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { HOME_COPY, onlyVisible } from './home-e2e';
import { LANGUAGE_ROWS, menuName, rowName, type MenuLocale } from './language-menu-copy';

// Shared fixtures for the FE-7 PR 3 language menu Playwright spec. Content
// is the vendored mock bundle (DATA_SOURCE=mock).

// The header's language button the current layout shows: its name is the
// visible code plus the localized "Language" (FE-4).
export const languageButton = (page: Page, lang: MenuLocale): Locator =>
	onlyVisible(page.getByRole('button', { name: new RegExp(HOME_COPY[lang].language) }));

export const languageMenu = (page: Page, lang: MenuLocale): Locator =>
	onlyVisible(page.getByRole('menu', { name: menuName(lang) }));

export function menuRow(page: Page, lang: MenuLocale, to: MenuLocale): Locator {
	const name = LANGUAGE_ROWS.find((row) => row.code === to)!.name;
	return languageMenu(page, lang).getByRole('menuitem', { name: rowName(name) });
}

export async function openMenu(page: Page, lang: MenuLocale) {
	await languageButton(page, lang).click();
	await expect(languageMenu(page, lang)).toBeVisible();
	await expect(languageButton(page, lang)).toHaveAttribute('aria-expanded', 'true');
}

// From the keyboard: a sheet's scrim may cover the header on mobile, but a
// peek sheet is not modal, so the button stays reachable.
export async function openMenuByKeyboard(page: Page, lang: MenuLocale, key = 'Enter') {
	await languageButton(page, lang).focus();
	await page.keyboard.press(key);
	await expect(languageMenu(page, lang)).toBeVisible();
}

export async function expectMenuClosed(page: Page, lang: MenuLocale) {
	await expect(languageMenu(page, lang)).toHaveCount(0);
	await expect(languageButton(page, lang)).toHaveAttribute('aria-expanded', 'false');
}

// The focused row's language name, or what has focus instead.
export function focusedRow(page: Page): Promise<string> {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (el?.getAttribute('role') === 'menuitem') return el.textContent?.trim().split(/\s/)[0] ?? '';
		return `(focus on <${el?.tagName.toLowerCase()}>)`;
	});
}

// Every /set-lang response from now on (the 303 that sets the cookie).
export function recordSetLangResponses(page: Page): Response[] {
	const responses: Response[] = [];
	page.on('response', (res) => {
		if (new URL(res.url()).pathname === '/set-lang') responses.push(res);
	});
	return responses;
}

// Whether a pointer at the element's centre lands on it (nothing covers it).
export function isOnTop(locator: Locator): Promise<boolean> {
	return locator.evaluate((el) => {
		const rect = el.getBoundingClientRect();
		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		return hit !== null && (hit === el || el.contains(hit));
	});
}
