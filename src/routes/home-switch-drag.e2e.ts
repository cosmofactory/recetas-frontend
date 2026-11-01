import { expect, test, type Page, type TestInfo } from '../testutil/e2e-test';
import {
	boxOf,
	gotoHydrated,
	HOME_COPY,
	isDesktopPage,
	pathAndQuery,
	right,
	visibleMap
} from '../testutil/home-e2e';
import {
	centre,
	expectSameBox,
	mouseDrag,
	nextPaint,
	settle,
	TouchDrag,
	visibleTab,
	visibleThumb
} from '../testutil/segmented-switch-e2e';

// FE-9 FB-3, spec addition D-FE9-2 (owner, 2026-11-01), on the home's
// Regional | Popular switch:
// - "One thumb ... slides under the labels to the chosen segment"; at rest
//   it covers the active segment exactly (mobile header and desktop top bar,
//   en and the long ru labels).
// - "The thumb can be dragged along the track; on release it snaps to the
//   nearer segment and selects it. Tap still selects." Selecting by drag
//   lands on the same URL as tapping: /:lang/?tab=popular, or /:lang/ with
//   no tab param for Regional; a short drag snaps back and keeps the tab.
// - While the finger is down the thumb follows it, clamped to the track.
// Unchanged behaviour (tab semantics, ?tab=, closing sheets) stays covered
// by home-shell.e2e.ts.

const en = HOME_COPY.en;
// Travel well under half a segment: must snap back.
const SHORT_DRAG_PX = 30;
// Travel to show the thumb following the finger.
const FOLLOW_PX = 40;
// Past the end of any track: the thumb must stop at the last segment.
const OVERSHOOT_PX = 400;
// A finger position read back after a paint; allows sub-pixel rounding.
const FOLLOW_TOLERANCE_PX = 2;

function skipUnlessChromiumTouch(page: Page, testInfo: TestInfo) {
	const engine = testInfo.project.use.defaultBrowserType ?? testInfo.project.use.browserName;
	test.skip(engine !== 'chromium', 'CDP touch input: Chromium only');
	test.skip(isDesktopPage(page) || !testInfo.project.use.hasTouch, 'touch drag: the mobile header');
}

const historyLength = (page: Page) => page.evaluate(() => history.length);

async function expectPopularShown(page: Page) {
	await expect.poll(() => pathAndQuery(page), 'want Popular selected').toBe('/en/?tab=popular');
	await expect(visibleTab(page, en.popular)).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel', { name: en.popular, exact: true })).toBeVisible();
}

async function expectRegionalShown(page: Page) {
	await expect.poll(() => pathAndQuery(page), 'want Regional selected').toBe('/en/');
	await expect(visibleTab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
	await expect(visibleMap(page), 'want the map back on Regional').toHaveCount(1);
}

// Drags the thumb from the selected segment's centre by `dx` with a finger.
async function touchDragThumb(page: Page, from: string, dx: number) {
	const start = centre(await boxOf(visibleTab(page, from), from));
	const drag = await TouchDrag.start(page, start);
	await drag.moveTo({ x: start.x + dx, y: start.y });
	await drag.end();
}

test.describe('sliding switch: touch drag (mobile, Chromium)', () => {
	test('dragging the thumb from Regional to Popular selects Popular', async ({
		page
	}, testInfo) => {
		skipUnlessChromiumTouch(page, testInfo);
		await gotoHydrated(page, '/en/');
		const popular = await boxOf(visibleTab(page, en.popular), 'Popular');
		const regional = await boxOf(visibleTab(page, en.regional), 'Regional');
		await touchDragThumb(page, en.regional, centre(popular).x - centre(regional).x);
		await expectPopularShown(page);
		await settle(visibleThumb(page));
		await expectSameBox(visibleThumb(page), visibleTab(page, en.popular), 'after the drag');
	});

	test('dragging the thumb from Popular to Regional selects Regional (no tab param)', async ({
		page
	}, testInfo) => {
		skipUnlessChromiumTouch(page, testInfo);
		await gotoHydrated(page, '/en/?tab=popular');
		const popular = await boxOf(visibleTab(page, en.popular), 'Popular');
		const regional = await boxOf(visibleTab(page, en.regional), 'Regional');
		await touchDragThumb(page, en.popular, centre(regional).x - centre(popular).x);
		await expectRegionalShown(page);
	});

	test('a short drag snaps back to Regional and keeps the URL', async ({ page }, testInfo) => {
		skipUnlessChromiumTouch(page, testInfo);
		await gotoHydrated(page, '/en/');
		await touchDragThumb(page, en.regional, SHORT_DRAG_PX);
		await settle(visibleThumb(page));
		expect(pathAndQuery(page), 'got a navigation after a short drag').toBe('/en/');
		await expect(visibleTab(page, en.regional)).toHaveAttribute('aria-selected', 'true');
		await expectSameBox(visibleThumb(page), visibleTab(page, en.regional), 'after snapping back');
	});

	test('while the finger is down the thumb follows it, clamped to the track', async ({
		page
	}, testInfo) => {
		skipUnlessChromiumTouch(page, testInfo);
		await gotoHydrated(page, '/en/');
		const thumb = visibleThumb(page);
		await settle(thumb);
		const before = await boxOf(thumb, 'thumb at rest');
		const start = centre(await boxOf(visibleTab(page, en.regional), 'Regional'));
		const drag = await TouchDrag.start(page, start);
		await drag.moveTo({ x: start.x + FOLLOW_PX, y: start.y });
		await nextPaint(page);
		const following = await boxOf(thumb, 'thumb mid-drag');
		expect(
			Math.abs(following.x - (before.x + FOLLOW_PX)),
			`got thumb at x ${following.x}, want ${before.x + FOLLOW_PX} (under the finger)`
		).toBeLessThanOrEqual(FOLLOW_TOLERANCE_PX);
		await drag.moveTo({ x: start.x + OVERSHOOT_PX, y: start.y });
		await nextPaint(page);
		const clamped = right(await boxOf(thumb, 'thumb past the end'));
		const trackEnd = right(await boxOf(visibleTab(page, en.popular), 'Popular'));
		expect(
			Math.abs(clamped - trackEnd),
			`got thumb right edge ${clamped}, want it stopped at the last segment's ${trackEnd}`
		).toBeLessThanOrEqual(FOLLOW_TOLERANCE_PX);
		await drag.end();
		await expectPopularShown(page);
	});
});

test.describe('sliding switch: pointer drag and tap (every engine)', () => {
	test(
		'a pointer drag of the thumb from Regional to Popular selects Popular',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			const from = centre(await boxOf(visibleTab(page, en.regional), 'Regional'));
			const to = centre(await boxOf(visibleTab(page, en.popular), 'Popular'));
			await mouseDrag(page, from, to);
			await expectPopularShown(page);
		}
	);

	// A drag-select is the tab's own navigation, like a tap: one new history
	// entry (not two, not a replace), and Back undoes it.
	test(
		'a drag to Popular adds one history entry; Back returns to Regional',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/');
			const entriesBefore = await historyLength(page);
			const from = centre(await boxOf(visibleTab(page, en.regional), 'Regional'));
			const to = centre(await boxOf(visibleTab(page, en.popular), 'Popular'));
			await mouseDrag(page, from, to);
			await expectPopularShown(page);
			expect(await historyLength(page), 'want exactly one new history entry').toBe(
				entriesBefore + 1
			);
			await page.goBack();
			await expectRegionalShown(page);
			await settle(visibleThumb(page));
			await expectSameBox(visibleThumb(page), visibleTab(page, en.regional), 'after Back');
		}
	);

	test(
		'a short pointer drag on Popular snaps back and keeps ?tab=popular',
		{ tag: '@cross-browser' },
		async ({ page }) => {
			await gotoHydrated(page, '/en/?tab=popular');
			const from = centre(await boxOf(visibleTab(page, en.popular), 'Popular'));
			await mouseDrag(page, from, { x: from.x - SHORT_DRAG_PX, y: from.y });
			await settle(visibleThumb(page));
			expect(pathAndQuery(page), 'got a navigation after a short drag').toBe('/en/?tab=popular');
			await expectSameBox(visibleThumb(page), visibleTab(page, en.popular), 'after snapping back');
		}
	);

	test(
		'a tap on Popular still selects it',
		{ tag: '@cross-browser' },
		async ({ page }, testInfo) => {
			test.skip(!testInfo.project.use.hasTouch, 'tap: touch projects only');
			await gotoHydrated(page, '/en/');
			await visibleTab(page, en.popular).tap();
			await expectPopularShown(page);
		}
	);
});

test.describe('sliding switch: the thumb covers the active segment', () => {
	const cases = [
		{ lang: 'en', url: '/en/', active: HOME_COPY.en.regional },
		{ lang: 'en', url: '/en/?tab=popular', active: HOME_COPY.en.popular },
		{ lang: 'ru', url: '/ru/', active: HOME_COPY.ru.regional },
		{ lang: 'ru', url: '/ru/?tab=popular', active: HOME_COPY.ru.popular }
	];
	for (const { url, active } of cases) {
		test(`${url}: the thumb's box is "${active}"'s box`, { tag: '@layout' }, async ({ page }) => {
			await gotoHydrated(page, url);
			await settle(visibleThumb(page));
			await expect(visibleThumb(page), 'want one visible thumb').toHaveCount(1);
			await expectSameBox(visibleThumb(page), visibleTab(page, active), url);
		});
	}
});
