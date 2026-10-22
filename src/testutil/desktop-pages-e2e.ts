import { expect, type Locator, type Page } from '@playwright/test';
import { boxOf, clampPx, HOME_COPY, pathAndQuery, type Box } from './home-e2e';
import type { VariationsLocale } from './variations-copy';

// Shared fixtures for the FE-6 PR 4 desktop (≥ 860px) Variations and Recipe
// specs: the back pill, the grids and the window scroll. Content is the
// vendored mock bundle (DATA_SOURCE=mock).

// Test id on the BackPill link (FE-6 PR 4 contract, on the <a> itself).
export const BACK_PILL_TEST_ID = 'back-pill';

// Desktop README -> Layout & screens: "Content max-width 1440px, centred.
// Side padding ... clamp(24px, 2.8vw, 40px)".
const CONTENT_MAX_WIDTH_PX = 1440;
const SIDE_PADDING = { min: 24, vw: 0.028, max: 40 } as const;

// A shorter window, so pages have room to scroll at every desktop width.
export const SHORT_VIEWPORT_HEIGHT_PX = 600;
// A mobile width for the 860px crossing checks.
export const MOBILE_WIDTH_PX = 600;
const SCROLL_TOLERANCE_PX = 1;

// The home tab labels the pill borrows (prototype dishBack / recipeBack).
export const pillHomeLabel = (lang: VariationsLocale, tab: 'popular' | 'regional') =>
	HOME_COPY[lang][tab];

export const backPill = (page: Page): Locator => page.getByTestId(BACK_PILL_TEST_ID);

// The pill reads `label` (the "‹" is an aria-hidden icon), and is named by it.
export async function expectPill(page: Page, label: string) {
	await expect(backPill(page), 'want the desktop back pill').toBeVisible();
	await expect(backPill(page)).toHaveText(label);
	await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
		'data-testid',
		BACK_PILL_TEST_ID
	);
}

// Clicks the pill, failing fast and by name when there is none.
export async function clickPill(page: Page) {
	await expect(backPill(page), 'want the desktop back pill').toBeVisible();
	await backPill(page).click();
}

export async function expectPillWithHref(page: Page, label: string, href: string) {
	await expectPill(page, label);
	await expect(backPill(page)).toHaveAttribute('href', href);
}

export async function expectUrl(page: Page, want: string) {
	await page.waitForURL((url) => url.pathname + url.search === want);
	expect(pathAndQuery(page)).toBe(want);
}

// The page container's content box at this window (1440px cap, fluid padding).
export async function contentBox(page: Page): Promise<{ x: number; width: number }> {
	const { vw, clientWidth } = await page.evaluate(() => ({
		vw: window.innerWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	const sidePad = clampPx(SIDE_PADDING.min, SIDE_PADDING.vw * vw, SIDE_PADDING.max);
	const container = Math.min(clientWidth, CONTENT_MAX_WIDTH_PX);
	return { x: (clientWidth - container) / 2 + sidePad, width: container - 2 * sidePad };
}

export type GridInfo = { tracks: number[]; columnGap: number; rowGap: number; box: Box };

// The nearest display:grid ancestor's resolved column tracks (px) and gaps.
export async function gridAround(locator: Locator, what: string): Promise<GridInfo> {
	const info = await locator.evaluate((el) => {
		let grid = el.parentElement;
		while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement;
		if (!grid) return null;
		const s = getComputedStyle(grid);
		const r = grid.getBoundingClientRect();
		return {
			tracks: s.gridTemplateColumns.split(' ').map(parseFloat),
			columnGap: parseFloat(s.columnGap) || 0,
			rowGap: parseFloat(s.rowGap) || 0,
			box: { x: r.x, y: r.y, width: r.width, height: r.height }
		};
	});
	expect(info, `got no grid around ${what}, want a display: grid layout`).not.toBeNull();
	return info!;
}

// Which column of `grid` a box starts in (0-based), from the resolved tracks.
export function columnOf(grid: GridInfo, box: Box): number {
	let x = grid.box.x;
	for (const [i, track] of grid.tracks.entries()) {
		if (box.x < x + track - 1) return i;
		x += track + grid.columnGap;
	}
	return grid.tracks.length;
}

// The visible photo placeholder inside `container` (no MEDIA_BASE_URL in E2E).
export const visiblePhoto = (container: Locator): Locator =>
	container.locator('.placeholder').filter({ visible: true }).first();

export async function photoHeight(container: Locator, what: string): Promise<number> {
	return (await boxOf(visiblePhoto(container), what)).height;
}

// The Recipe page's ingredients card (FE-6 PR 4 contract): the element that
// holds the "Ingredients" heading and every ingredient row, and is sticky.
export const INGREDIENTS_CARD_TEST_ID = 'recipe-ingredients-card';

export const ingredientsCard = (page: Page): Locator => page.getByTestId(INGREDIENTS_CARD_TEST_ID);

export async function expectIngredientsCard(page: Page) {
	await expect(ingredientsCard(page), 'want the ingredients card').toBeVisible();
}

export const maxWindowScroll = (page: Page): Promise<number> =>
	page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight);

export async function expectWindowScroll(page: Page, want: number, what: string) {
	await expect
		.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - want), {
			message: `want ${what} at window scrollY ${want}`
		})
		.toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
}

export async function useShortWindow(page: Page) {
	const width = page.viewportSize()!.width;
	await page.setViewportSize({ width, height: SHORT_VIEWPORT_HEIGHT_PX });
}
