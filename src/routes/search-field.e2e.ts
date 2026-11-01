import { expect, test, type Page } from '../testutil/e2e-test';
import { focusDesktopSearch } from '../testutil/desktop-search-e2e';
import { gotoHydrated } from '../testutil/home-e2e';
import { skipOnDesktop, skipOnMobile } from '../testutil/popular-e2e';
import { openSearch } from '../testutil/search-e2e';
import {
	DESKTOP_FINE_POINTER_FONT_PX,
	desktopSearchParts,
	expectNoOwnRing,
	expectNoZoomFontSize,
	expectOwnSharedRing,
	expectRingOnPill,
	fontSizePx,
	matchesCoarsePointer,
	mobileSearchParts,
	ZOOM_BLOCKING_VIEWPORT,
	type SearchFieldParts
} from '../testutil/search-field-e2e';

// FE-9 PR 1, the search field (SearchField, in the mobile overlay and the
// desktop top bar).
//
// Sources: stage FE-9 -> FB-9 (iOS zoom on focus; D-FE9-5: the input is 16px
// on phones and under `pointer: coarse`, 14px on desktop with a mouse; never
// `maximum-scale` in the viewport meta, WCAG 1.4.4) and FB-7 (the focus ring
// is drawn on the pill with and without text, not on the narrowed input).

const HOME = '/en/';
const QUERY = 'tortilla';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function openMobileSearch(page: Page): Promise<SearchFieldParts> {
	await gotoHydrated(page, HOME);
	await openSearch(page, 'en');
	return mobileSearchParts(page);
}

async function focusDesktopField(page: Page): Promise<SearchFieldParts> {
	await gotoHydrated(page, HOME);
	await focusDesktopSearch(page, 'en');
	return desktopSearchParts(page);
}

// Empty, then with text (the "×" narrows the input), then with focus on
// the "×" itself (Tab from the input), which also draws its own ring.
async function expectRingFollowsPill(page: Page, parts: SearchFieldParts) {
	await expectRingOnPill(page, parts, 'focused, empty');
	await expectNoOwnRing(parts.input, parts.what);
	await parts.input.fill(QUERY);
	await expectRingOnPill(page, parts, 'focused, with text');
	await expectNoOwnRing(parts.input, parts.what);
	await page.keyboard.press('Tab');
	const clear = parts.field.getByRole('button');
	await expect(clear, 'want focus on the clear "×"').toBeFocused();
	await expectRingOnPill(page, parts, 'the clear "×" focused');
	await expectOwnSharedRing(page, clear, `${parts.what}'s clear "×"`);
}

test.describe('FB-9 on the phone layout', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page, 'the mobile search overlay (< 860px)'));

	test(
		'the overlay input is at least 16px, so iOS Safari does not zoom on focus',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			const { input, what } = await openMobileSearch(page);
			await expectNoZoomFontSize(input, what);
		}
	);
});

test.describe('FB-9 on the desktop layout with a touch screen', () => {
	// Playwright has no `pointer` media emulation; touch emulation (hasTouch)
	// is what makes the engine report `(pointer: coarse)`, as an iPad in
	// landscape (≥ 860px) does. The precondition is checked, so a browser that
	// ignores it fails loudly instead of testing a fine pointer.
	test.use({ viewport: DESKTOP_VIEWPORT, hasTouch: true });

	test('the top-bar input is at least 16px under a coarse pointer', async ({ page }) => {
		const { input, what } = await focusDesktopField(page);
		expect(await matchesCoarsePointer(page), 'want (pointer: coarse) to match').toBe(true);
		await expectNoZoomFontSize(input, what);
	});
});

test.describe('FB-9 on the desktop layout with a mouse', () => {
	test.use({ viewport: DESKTOP_VIEWPORT, hasTouch: false, isMobile: false });

	test('the top-bar input stays 14px under a fine pointer', async ({ page }) => {
		const { input, what } = await focusDesktopField(page);
		expect(await matchesCoarsePointer(page), 'want (pointer: coarse) not to match').toBe(false);
		const got = await fontSizePx(input);
		expect(got, `got ${what} font-size ${got}px, want ${DESKTOP_FINE_POINTER_FONT_PX}px`).toBe(
			DESKTOP_FINE_POINTER_FONT_PX
		);
	});
});

test('the viewport meta keeps pinch-zoom (no maximum-scale, no user-scalable=no)', async ({
	page
}) => {
	await gotoHydrated(page, HOME);
	const content = (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
	for (const blocking of ZOOM_BLOCKING_VIEWPORT) {
		expect(content, `got viewport "${content}", want no match for ${blocking}`).not.toMatch(
			blocking
		);
	}
});

test.describe('FB-7 focus ring on the pill', () => {
	test(
		'mobile overlay: the ring is the pill, with and without text',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			skipOnDesktop(page, 'the mobile search overlay (< 860px)');
			await expectRingFollowsPill(page, await openMobileSearch(page));
		}
	);

	test(
		'desktop top bar: the ring is the pill, with and without text',
		{ tag: ['@cross-browser'] },
		async ({ page }) => {
			skipOnMobile(page, 'the desktop top-bar search (≥ 860px)');
			await expectRingFollowsPill(page, await focusDesktopField(page));
		}
	);
});
