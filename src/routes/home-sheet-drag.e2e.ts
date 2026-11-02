import { expect, test, type Page, type TestInfo } from '../testutil/e2e-test';
import { boxOf, gotoHydrated, HOME_COPY, isDesktopPage, pathAndQuery } from '../testutil/home-e2e';
import { dishSheet } from '../testutil/popular-e2e';
import { TORTILLA_SHEET } from '../testutil/popular-copy';
import {
	activateRegion,
	expectSheetExpanded,
	expectSheetHidden,
	expectSheetPeek,
	ANDALUCIA_EN,
	GALICIA_EN,
	historyLength,
	regionSheet,
	selectedRegions
} from '../testutil/region-e2e';
import {
	bodyScrollTop,
	chromiumTouchSkipReason,
	delayAppRequests,
	dragBy,
	expectSheetTopNear,
	FLICK,
	FLICK_PX,
	holdDrag,
	largestRise,
	settleSheet,
	sheetHandle,
	sheetTop,
	SLOW,
	startTopSampling,
	stopTopSampling,
	SWIPE
} from '../testutil/sheet-drag-e2e';
import { sheetBody } from '../testutil/sheet-end-e2e';
import { centre, mouseDrag, visibleTab } from '../testutil/segmented-switch-e2e';

// FE-9 FB-2, spec addition D-FE9-1 (owner, 2026-11-01): "pointer drag on
// the handle and header" of the region sheet (and every BottomSheet: the
// Popular dish sheet shares it through UrlSheet).
// - "The sheet follows the finger (no transition while dragging)."
// - "On release, it snaps: up from peek → expanded; down from expanded →
//   peek; down from peek → hidden and the region is deselected (as the
//   scrim tap)." As the scrim: the URL goes back to /:lang/ as a new entry,
//   so Back reopens the region; the dish sheet drops ?dish the same way.
//   Expanding or collapsing stays local (no URL change, no history entry).
// - "Threshold 80 px, or a fast flick; otherwise it snaps back."
// - "Dragging inside the scrollable content scrolls it. Tap-to-toggle,
//   keyboard and screen-reader behaviour stay as they are."
// FB-5 (gesture part): "Scrolling up on the content in peek expands the
// sheet first, then scrolls (native sheet behaviour)."
//
// "Header" = the sheet's title row (the region name, an <h2>), above the
// list; the handle and the header both drag the sheet in every state.
// Unpinned: a downward swipe on the list at scrollTop 0 while expanded.
//
// Touch tests use CDP touch (Chromium); the mouse tests run on every engine
// that has a mobile project (WebKit iPhone), tagged @cross-browser.

// Andalucía: one of the two longest region lists (6 rows), so the expanded
// sheet's content still scrolls at every phone size.
const REGION = ANDALUCIA_EN;
const REGION_URL = `/en/regions/${REGION.key}`;
const TORTILLA_URL = '/en/?tab=popular&dish=tortilla';
// Past the 80px threshold, and under it.
const LONG_DRAG_PX = 150;
const SHORT_DRAG_PX = 40;
const FOLLOW_PX = 100;
const SWIPE_PX = 200;

function skipUnlessTouch(page: Page, testInfo: TestInfo) {
	const reason = chromiumTouchSkipReason(page, testInfo);
	test.skip(reason !== undefined, reason);
}

function skipOnDesktop(page: Page) {
	test.skip(isDesktopPage(page), 'the mobile BottomSheet (< 860px)');
}

const header = (page: Page) =>
	regionSheet(page).getByRole('heading', { level: 2, name: REGION.name, exact: true });
const description = (page: Page) =>
	regionSheet(page).getByText(REGION.description, { exact: true });
const rows = (page: Page) => regionSheet(page).locator('a[href^="/en/dishes/"]');
const listRow = (page: Page) => rows(page).nth(1);

async function openRegion(page: Page) {
	await gotoHydrated(page, REGION_URL);
	await expectSheetPeek(page, REGION.name);
}

async function openRegionExpanded(page: Page) {
	await openRegion(page);
	await sheetHandle(page).click();
	await expectSheetExpanded(page, REGION.name);
}

// What the scrim tap does: back to /en/ as one new entry, nothing selected,
// and Back reopens the region in peek.
async function expectDeselectedLikeScrim(page: Page, entriesBefore: number) {
	await expect.poll(() => pathAndQuery(page), 'want the region deselected').toBe('/en/');
	await expectSheetHidden(page);
	await expect(selectedRegions(page), 'want no region selected').toHaveCount(0);
	expect(await historyLength(page), 'want one new entry for the close').toBe(entriesBefore + 1);
	await page.goBack();
	await expectSheetPeek(page, REGION.name);
}

async function expectStillAt(page: Page, url: string, entriesBefore: number) {
	expect(pathAndQuery(page), 'got a navigation').toBe(url);
	expect(await historyLength(page), 'got a new history entry').toBe(entriesBefore);
}

test.describe('region sheet: touch drag on the handle (mobile, Chromium)', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('up from peek expands; the URL stays', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, sheetHandle(page), -LONG_DRAG_PX, { pace: SLOW });
		await expectSheetExpanded(page, REGION.name);
		await expectStillAt(page, REGION_URL, entries);
	});

	test('down from expanded goes to peek; the URL stays', async ({ page }) => {
		await openRegionExpanded(page);
		const entries = await historyLength(page);
		await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
		await expectSheetPeek(page, REGION.name);
		await expectStillAt(page, REGION_URL, entries);
	});

	test('down from peek hides it and deselects the region, as the scrim does', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
		await expectDeselectedLikeScrim(page, entries);
	});

	test('a slow short drag up snaps back to peek', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, sheetHandle(page), -SHORT_DRAG_PX, { pace: SLOW });
		await settleSheet(page);
		await expectSheetPeek(page, REGION.name);
		await expectStillAt(page, REGION_URL, entries);
	});

	test('a slow short drag down snaps back to peek and keeps the region', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, sheetHandle(page), SHORT_DRAG_PX, { pace: SLOW });
		await settleSheet(page);
		await expectSheetPeek(page, REGION.name);
		await expectStillAt(page, REGION_URL, entries);
	});

	test('a fast 70px flick down from expanded goes to peek', async ({ page }) => {
		await openRegionExpanded(page);
		await dragBy(page, sheetHandle(page), FLICK_PX, { pace: FLICK });
		await expectSheetPeek(page, REGION.name);
	});

	test('a fast 70px flick up from peek expands', async ({ page }) => {
		await openRegion(page);
		await dragBy(page, sheetHandle(page), -FLICK_PX, { pace: FLICK });
		await expectSheetExpanded(page, REGION.name);
	});

	test('while the finger is down the sheet follows it', async ({ page }) => {
		await openRegion(page);
		const rest = await sheetTop(page);
		const drag = await holdDrag(page, sheetHandle(page), -FOLLOW_PX);
		await expectSheetTopNear(page, rest - FOLLOW_PX, 'mid-drag up');
		await drag.end();
	});
});

test.describe('region sheet: touch drag on the header (mobile, Chromium)', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('down from peek on the region name hides it and deselects', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, header(page), LONG_DRAG_PX, { pace: SLOW });
		await expectDeselectedLikeScrim(page, entries);
	});

	test('down from expanded on the region name goes to peek', async ({ page }) => {
		await openRegionExpanded(page);
		await dragBy(page, header(page), LONG_DRAG_PX, { pace: SLOW });
		await expectSheetPeek(page, REGION.name);
	});
});

test.describe('region sheet: swipes on the list (mobile, Chromium)', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('in peek, an upward swipe on the list expands the sheet first', async ({ page }) => {
		await openRegion(page);
		await dragBy(page, listRow(page), -SWIPE_PX, { pace: SWIPE });
		await expectSheetExpanded(page, REGION.name);
		expect(pathAndQuery(page), 'got a navigation (a row tapped?)').toBe(REGION_URL);
		expect(await bodyScrollTop(page), 'got the list scrolled while in peek').toBe(0);
	});

	// Accepted behaviour (FB-2 follow-up): in peek the content drags like the
	// handle. The description, not a row: a row sits too low in peek for a
	// 150px swipe to stay on screen.
	test('in peek, a downward swipe on the content hides it and deselects', async ({ page }) => {
		await openRegion(page);
		const entries = await historyLength(page);
		await dragBy(page, description(page), LONG_DRAG_PX, { pace: SLOW });
		await expectDeselectedLikeScrim(page, entries);
	});

	test('once expanded, an upward swipe on the list scrolls it', async ({ page }) => {
		await openRegionExpanded(page);
		await dragBy(page, listRow(page), -SWIPE_PX, { pace: SWIPE });
		await expect.poll(() => bodyScrollTop(page), 'want the list scrolled').toBeGreaterThan(0);
		await settleSheet(page);
		await expectSheetExpanded(page, REGION.name);
	});
});

test.describe('dish sheet: touch drag on the handle (mobile, Chromium)', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('down from peek closes it and drops ?dish, as the scrim does', async ({ page }) => {
		await gotoHydrated(page, TORTILLA_URL);
		await expectSheetPeek(page, TORTILLA_SHEET.en.name);
		const entries = await historyLength(page);
		await expect(dishSheet(page)).toHaveAttribute('data-state', 'peek');
		await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
		await expect.poll(() => pathAndQuery(page), 'want ?dish dropped').toBe('/en/?tab=popular');
		await expectSheetHidden(page);
		expect(await historyLength(page), 'want one new entry for the close').toBe(entries + 1);
	});
});

test.describe('region sheet: mouse drag and tap (every engine)', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page));

	test('a mouse drag up on the handle expands it', { tag: '@cross-browser' }, async ({ page }) => {
		await openRegion(page);
		await dragBy(page, sheetHandle(page), -LONG_DRAG_PX, { input: 'mouse', pace: SLOW });
		await expectSheetExpanded(page, REGION.name);
		expect(pathAndQuery(page)).toBe(REGION_URL);
	});

	test(
		'a mouse drag down on the handle from peek hides it and deselects',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openRegion(page);
			const entries = await historyLength(page);
			await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { input: 'mouse', pace: SLOW });
			await expectDeselectedLikeScrim(page, entries);
		}
	);

	test(
		'a tap on the handle still toggles peek and expanded',
		{ tag: '@cross-browser' },
		async ({ page }, testInfo) => {
			test.skip(!testInfo.project.use.hasTouch, 'tap: touch projects only');
			await openRegion(page);
			await sheetHandle(page).tap();
			await expectSheetExpanded(page, REGION.name);
			await sheetHandle(page).tap();
			await expectSheetPeek(page, REGION.name);
		}
	);
});

// FB-2 review findings (2026-11-02).
// - Bounce on hide: a drag down from peek asks for hidden, but the state
//   only changes once the deselect's navigation lands; until then the sheet
//   must hold where it was released (or move down), never slide back up
//   toward peek. A slow navigation (delayed app requests) makes the gap
//   visible; every frame is sampled.
// - Reduced motion: the same drag fades the sheet out where it was
//   released, with no jump back up first.
// - Before hydration (or without JavaScript) nothing can drag the sheet, so
//   the peek body must stay touch-scrollable: no touch-action that blocks
//   vertical panning, and a finger swipe scrolls it to the rows below.
// - Mouse drags: dragging across the region name selects no text, and a
//   drag that starts on a row link expands the sheet instead of starting the
//   browser's own link drag (which cancels the pointer, e.g. in Firefox).
//   These set a phone-sized viewport themselves, so they also run on the
//   desktop-only Firefox and WebKit projects.

// Slow enough that the deselect lands many frames after the release.
const NAV_DELAY_MS = 800;
// Sub-pixel rounding between frames.
const RISE_TOLERANCE_PX = 2;
const PHONE_VIEWPORT = { width: 390, height: 844 };
// Diagonal travel across the region name, so a text selection would grow.
const ACROSS_TEXT_PX = 80;
// Any value that keeps vertical panning (the browser's own scroll).
const PANS_VERTICALLY = /^(auto|manipulation)$|pan-y/;

async function expectNoRise(page: Page, what: string) {
	const tops = await stopTopSampling(page);
	const { rise, frame } = largestRise(tops);
	expect(
		rise,
		`${what}: got the sheet's top back up ${rise.toFixed(1)}px in frame ${frame} of ` +
			`${tops.length}, want ≤ ${RISE_TOLERANCE_PX}px (hold or move down)`
	).toBeLessThanOrEqual(RISE_TOLERANCE_PX);
}

// Opens the region, slows the app's navigations, samples every frame and
// drags the sheet down from peek until it is hidden.
async function dragDownToHideSlowly(page: Page) {
	await openRegion(page);
	await delayAppRequests(page, NAV_DELAY_MS);
	await startTopSampling(page);
	await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
	await expect.poll(() => pathAndQuery(page), 'want the region deselected').toBe('/en/');
	await expectSheetHidden(page);
}

test.describe('region sheet: hiding by drag never bounces (mobile, Chromium)', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('with a slow navigation, the sheet holds or moves down until hidden', async ({ page }) => {
		await dragDownToHideSlowly(page);
		await expectNoRise(page, 'drag down from peek, slow navigation');
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('the sheet fades out where it was released, never jumping back up', async ({ page }) => {
			await dragDownToHideSlowly(page);
			await expectNoRise(page, 'drag down from peek, reduced motion');
		});
	});
});

test.describe('region sheet before hydration (no JavaScript)', () => {
	test.use({ javaScriptEnabled: false });

	test('the peek body keeps vertical panning', { tag: '@cross-browser' }, async ({ page }) => {
		skipOnDesktop(page);
		await page.goto(REGION_URL);
		const sheet = regionSheet(page);
		await expect(sheet).toHaveAttribute('data-state', 'peek');
		const touchAction = await sheetBody(sheet).evaluate((el) => getComputedStyle(el).touchAction);
		expect(touchAction, `got touch-action ${touchAction} on the peek body`).toMatch(
			PANS_VERTICALLY
		);
	});

	test('a finger swipe up scrolls the peek body', async ({ page }, testInfo) => {
		skipUnlessTouch(page, testInfo);
		await page.goto(REGION_URL);
		await expect(regionSheet(page)).toHaveAttribute('data-state', 'peek');
		await dragBy(page, description(page), -SWIPE_PX, { pace: SWIPE });
		await expect
			.poll(() => bodyScrollTop(page), 'want the peek body scrolled by the swipe')
			.toBeGreaterThan(0);
	});
});

test.describe('region sheet: mouse drags on text and links (every engine)', () => {
	test.beforeEach(({ page }) => page.setViewportSize(PHONE_VIEWPORT));

	test(
		'a mouse drag across the region name selects no text',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openRegion(page);
			const from = centre(await boxOf(header(page), 'region name'));
			const to = { x: from.x + ACROSS_TEXT_PX, y: from.y - LONG_DRAG_PX };
			await mouseDrag(page, from, to, SLOW);
			const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
			expect(selected, `got "${selected}" selected by the drag`).toBe('');
		}
	);

	test(
		'a mouse drag up that starts on a row link expands the sheet',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await openRegion(page);
			await expect(rows(page).first(), 'want the first row on screen in peek').toBeInViewport();
			await dragBy(page, rows(page).first(), -LONG_DRAG_PX, { input: 'mouse', pace: SLOW });
			await expectSheetExpanded(page, REGION.name);
			expect(pathAndQuery(page), 'got a navigation from the row').toBe(REGION_URL);
		}
	);
});

// FB-2 re-review (2026-11-02).
// - Stuck hold (major): a drag released to hidden holds the sheet where it
//   was let go until the sheet hides. Opening another region before that
//   (while the close navigation is still pending, or during the
//   reduced-motion fade) must bring the new region's sheet to rest at peek,
//   with no drag transform left inline (the reviewer saw its top at 684px,
//   the release point, instead of 534px).
// - Slide-off cancel (minor, main's FB-3 behaviour): a press on the active
//   tab that slides straight down off it (no horizontal travel, so never a
//   drag) and is released away is no tap, so the region stays open.

const GALICIA_URL = `/en/regions/${GALICIA_EN.key}`;
const SLIDE_OFF_PX = 150;
// Long enough for a client navigation to the bare home to land, if one started.
const NAV_SETTLE_MS = 500;

async function openGaliciaAndDragDown(page: Page) {
	await gotoHydrated(page, GALICIA_URL);
	await expectSheetPeek(page, GALICIA_EN.name);
	await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
}

async function expectRestingAtPeekFor(page: Page, name: string) {
	await expectSheetPeek(page, name);
	const transform = await regionSheet(page).evaluate((el) => (el as HTMLElement).style.transform);
	expect(transform, 'got the drag transform left on the sheet').toBe('');
}

test.describe('region sheet: another region opened while a drag-close is under way', () => {
	test.beforeEach(({ page }, testInfo) => skipUnlessTouch(page, testInfo));

	test('opened while the close navigation is pending, it rests at peek', async ({ page }) => {
		await gotoHydrated(page, GALICIA_URL);
		await expectSheetPeek(page, GALICIA_EN.name);
		await delayAppRequests(page, NAV_DELAY_MS);
		await dragBy(page, sheetHandle(page), LONG_DRAG_PX, { pace: SLOW });
		await activateRegion(page, REGION.key);
		await expectRestingAtPeekFor(page, REGION.name);
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		// The fade lasts --dur-sheet (450ms): the new region opens well inside it.
		test('opened during the fade-out, it rests at peek', async ({ page }) => {
			await openGaliciaAndDragDown(page);
			await page.waitForURL((url) => url.pathname + url.search === '/en/');
			await activateRegion(page, REGION.key);
			await expectRestingAtPeekFor(page, REGION.name);
		});
	});
});

test.describe('switch: a press that slides off the active tab', () => {
	test(
		'released 150px below the Regional tab, it does not close the region',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			// On mobile the open sheet's scrim covers the header, so the press is
			// a scrim tap (closes, by spec); the unit tests cover the switch there.
			test.skip(!isDesktopPage(page), 'desktop: the switch is reachable with a region open');
			await gotoHydrated(page, GALICIA_URL);
			const regional = visibleTab(page, HOME_COPY.en.regional);
			await expect(regional).toHaveAttribute('aria-selected', 'true');
			const from = centre(await boxOf(regional, 'Regional tab'));
			await mouseDrag(page, from, { x: from.x, y: from.y + SLIDE_OFF_PX });
			await page.waitForTimeout(NAV_SETTLE_MS);
			expect(pathAndQuery(page), 'got a navigation from a press slid off the tab').toBe(
				GALICIA_URL
			);
		}
	);
});
