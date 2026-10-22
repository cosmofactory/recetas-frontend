import { expect, test, type Locator, type Page } from '@playwright/test';
import { isDesktopPage, tokenValue } from './home-e2e';
import { PAGE_COPY, VARIATION_CARD_TEST_ID, type VariationsLocale } from './variations-copy';

// Shared fixtures for the FE-6 Variations page Playwright specs. Content is
// the vendored mock bundle (DATA_SOURCE=mock); copy is in variations-copy.ts.

// Stage FE-6 -> Small decisions: until PR 4 desktop renders the mobile
// layout, and desktop checks start in PR 4.
export function skipOnDesktopUntilPr4(page: Page) {
	test.skip(isDesktopPage(page), 'desktop Variations layout is FE-6 PR 4');
}

export const variationCards = (page: Page): Locator => page.getByTestId(VARIATION_CARD_TEST_ID);

export function backLink(page: Page, lang: VariationsLocale): Locator {
	return page.getByRole('link', { name: PAGE_COPY[lang].back, exact: true });
}

// StickyTopBar: the bar is the back link's parent element.
export const topBar = (page: Page, lang: VariationsLocale): Locator =>
	backLink(page, lang).locator('xpath=..');

export const barTitle = (page: Page, lang: VariationsLocale, title: string): Locator =>
	topBar(page, lang).getByText(title, { exact: true });

// Scrolls the window (the page itself, not a container) and says where it got.
export function scrollWindowTo(page: Page, y: number): Promise<number> {
	return page.evaluate((top) => {
		window.scrollTo(0, top);
		return window.scrollY;
	}, y);
}

export const windowScrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

type BarState = { titleOpacity: string; titleHidden: boolean; border: string };

async function barState(page: Page, lang: VariationsLocale, title: string): Promise<BarState> {
	const titleState = await barTitle(page, lang, title).evaluate((el) => ({
		titleOpacity: getComputedStyle(el).opacity,
		titleHidden: el.closest('[aria-hidden="true"]') !== null
	}));
	const border = await topBar(page, lang).evaluate((el) => getComputedStyle(el).borderBottomColor);
	return { ...titleState, border };
}

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// Past the threshold: the title is shown (opacity 1, exposed) and the
// hairline is --border-card; before it, faded, aria-hidden, transparent.
export async function expectBar(page: Page, lang: VariationsLocale, title: string, past: boolean) {
	const card = await tokenValue(
		page,
		'border-bottom-color',
		'var(--border-card)',
		'border-bottom-style: solid'
	);
	const want: BarState = past
		? { titleOpacity: '1', titleHidden: false, border: card }
		: { titleOpacity: '0', titleHidden: true, border: TRANSPARENT };
	await expect
		.poll(() => barState(page, lang, title), {
			message: `want the bar ${past ? 'past' : 'before'}`
		})
		.toEqual(want);
}

export async function expectBarStuckAtTop(page: Page, lang: VariationsLocale) {
	const top = await topBar(page, lang).evaluate((el) => el.getBoundingClientRect().top);
	expect(Math.abs(top), `got the bar ${top}px from the top, want stuck at 0`).toBeLessThanOrEqual(
		1
	);
}

// Every value <html data-page-push> and data-page-push-fallback take from now.
export async function recordPagePushMarks(page: Page) {
	await page.evaluate(() => {
		const seen: string[] = [];
		(window as unknown as { __pushMarks: string[] }).__pushMarks = seen;
		const root = document.documentElement;
		const record = () => {
			for (const attr of ['data-page-push', 'data-page-push-fallback']) {
				const value = root.getAttribute(attr);
				if (value) seen.push(value);
			}
		};
		new MutationObserver(record).observe(root, {
			attributes: true,
			attributeFilter: ['data-page-push', 'data-page-push-fallback']
		});
	});
}

export function pagePushMarks(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __pushMarks?: string[] }).__pushMarks ?? []);
}

export async function waitForPagePushEnd(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('data-page-push');
	await expect(page.locator('html')).not.toHaveAttribute('data-page-push-fallback');
}
