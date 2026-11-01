import { expect, type Locator, type Page } from '@playwright/test';
import { desktopSearchField, desktopSearchInput } from './desktop-search-e2e';
import { tokenValue } from './home-e2e';
import { RESULT_TEST_IDS } from './search-copy';
import { searchDialog } from './search-e2e';

// Shared fixtures for the FE-9 search field checks (FB-9 font size, FB-7
// focus ring) on the mobile overlay and the desktop top bar.

// iOS Safari zooms into a focused text field whose font is under 16px
// (FE-9 FB-9, D-FE9-5).
export const NO_ZOOM_MIN_FONT_PX = 16;

// Prototype: the desktop input is "font:500 14px" (kept with a mouse).
export const DESKTOP_FINE_POINTER_FONT_PX = 14;

// Pinch-zoom must stay available (WCAG 1.4.4): these block it.
export const ZOOM_BLOCKING_VIEWPORT = [/maximum-scale/i, /user-scalable\s*=\s*(no|0)/i];

export type SearchFieldParts = { what: string; field: Locator; input: Locator };

export const mobileSearchParts = (page: Page): SearchFieldParts => ({
	what: 'the mobile search overlay',
	field: searchDialog(page, 'en').getByTestId(RESULT_TEST_IDS.field),
	input: searchDialog(page, 'en').getByRole('combobox')
});

export const desktopSearchParts = (page: Page): SearchFieldParts => ({
	what: 'the desktop top-bar search',
	field: desktopSearchField(page),
	input: desktopSearchInput(page, 'en')
});

export async function fontSizePx(input: Locator): Promise<number> {
	return input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

export async function expectNoZoomFontSize(input: Locator, what: string) {
	const got = await fontSizePx(input);
	expect(
		got,
		`got ${what} font-size ${got}px, want >= ${NO_ZOOM_MIN_FONT_PX}px`
	).toBeGreaterThanOrEqual(NO_ZOOM_MIN_FONT_PX);
}

export const matchesCoarsePointer = (page: Page): Promise<boolean> =>
	page.evaluate(() => matchMedia('(pointer: coarse)').matches);

type Ring = { style: string; width: string; offset: string; color: string; shadow: string };

const ringOf = (target: Locator): Promise<Ring> =>
	target.evaluate((el) => {
		const s = getComputedStyle(el);
		return {
			style: s.outlineStyle,
			width: s.outlineWidth,
			offset: s.outlineOffset,
			color: s.outlineColor,
			shadow: s.boxShadow
		};
	});

// The shared focus ring (layout.css :focus-visible), as computed on this page.
async function sharedRing(page: Page): Promise<Ring> {
	const solid = 'outline-style: solid';
	return {
		style: 'solid',
		width: await tokenValue(page, 'outline-width', 'var(--focus-ring-width)', solid),
		offset: await tokenValue(page, 'outline-offset', 'var(--focus-ring-offset)', solid),
		color: await tokenValue(page, 'outline-color', 'var(--focus-ring)', solid),
		shadow: 'none'
	};
}

export async function expectNoOwnRing(input: Locator, what: string) {
	const ring = await ringOf(input);
	const drawn = ring.style !== 'none' && parseFloat(ring.width) > 0;
	expect(
		drawn,
		`got an outline on ${what}'s <input> (${ring.width} ${ring.style}), want none`
	).toBe(false);
	expect(ring.shadow, `got a box-shadow on ${what}'s <input>, want none`).toBe('none');
}

// The ring is the shared outline drawn on the pill itself, so it follows
// the pill's border box whatever the input's width (FE-9 FB-7).
export async function expectRingOnPill(page: Page, parts: SearchFieldParts, state: string) {
	const got = await ringOf(parts.field);
	const want = await sharedRing(page);
	expect(
		got,
		`${state}: got the pill's ring ${JSON.stringify(got)} on ${parts.what}, want the shared ring ${JSON.stringify(want)}`
	).toEqual(want);
}

// The "×" keeps its own shared ring inside the pill's, so moving focus onto
// it shows on screen (WCAG 2.4.7; FE-9 FB-7 review).
export async function expectOwnSharedRing(page: Page, control: Locator, what: string) {
	const got = await ringOf(control);
	const want = await sharedRing(page);
	expect(
		got,
		`got ${what}'s own ring ${JSON.stringify(got)}, want the shared ring ${JSON.stringify(want)}`
	).toEqual(want);
}
