import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { boxOf, isDesktopPage } from './home-e2e';
import { HANDLE_LABEL_EN, regionSheet } from './region-e2e';
import {
	centre,
	mouseDrag,
	nextPaint,
	TouchDrag,
	type Pace,
	type Point
} from './segmented-switch-e2e';
import { sheetBody } from './sheet-end-e2e';

// FE-9 FB-2 (D-FE9-1) and FB-5 scroll-to-expand: helpers for
// home-sheet-drag.e2e.ts, vertical drags on the mobile BottomSheet.

// Slow: 4px every 40ms (0.1 px/ms, far under any flick speed; a loaded
// machine only makes it slower). Flick: one move of FLICK_PX (under the 80px
// threshold), measured from the press, so it stays far over 0.5 px/ms even
// with input events 100ms apart.
export const SLOW: Pace = { stepPx: 4, pauseMs: 40 };
export const FLICK_PX = 70;
export const FLICK: Pace = { stepPx: FLICK_PX };
// A finger swipe on the content, fast enough to read as a scroll.
export const SWIPE: Pace = { stepPx: 10, pauseMs: 16 };

export type Input = 'touch' | 'mouse';
export type DragHow = { input?: Input; pace?: Pace };

// Real CDP touch input: Chromium only, and only where the page has touch.
export function chromiumTouchSkipReason(page: Page, testInfo: TestInfo): string | undefined {
	const engine = testInfo.project.use.defaultBrowserType ?? testInfo.project.use.browserName;
	if (engine !== 'chromium') return 'CDP touch input: Chromium only';
	if (isDesktopPage(page) || !testInfo.project.use.hasTouch) return 'the mobile sheet, touch';
	return undefined;
}

export function sheetHandle(page: Page): Locator {
	return regionSheet(page).getByRole('button', { name: HANDLE_LABEL_EN, exact: true });
}

// From the layout box: boundingBox() is null once a hidden sheet is
// visibility: hidden.
export async function sheetTop(page: Page): Promise<number> {
	return regionSheet(page).evaluate((el) => el.getBoundingClientRect().top);
}

export async function bodyScrollTop(page: Page): Promise<number> {
	return sheetBody(regionSheet(page)).evaluate((el) => el.scrollTop);
}

// Waits until every animation and transition in the sheet has finished.
export async function settleSheet(page: Page) {
	await regionSheet(page).evaluate(async (el) => {
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
	});
}

const below = (point: Point, dy: number): Point => ({ x: point.x, y: point.y + dy });

// Drags from `target`'s centre by `dy` (positive: down) and releases.
export async function dragBy(page: Page, target: Locator, dy: number, how: DragHow = {}) {
	const from = centre(await boxOf(target, 'drag start'));
	if (how.input === 'mouse') return mouseDrag(page, from, below(from, dy), how.pace);
	const drag = await TouchDrag.start(page, from);
	await drag.moveTo(below(from, dy), how.pace);
	await drag.end();
}

// A finger held down after travelling `dy` from `target`'s centre; end() it.
export async function holdDrag(page: Page, target: Locator, dy: number): Promise<TouchDrag> {
	const from = centre(await boxOf(target, 'drag start'));
	const drag = await TouchDrag.start(page, from);
	await drag.moveTo(below(from, dy));
	// Chromium delivers the last touchmove with the next animation frame.
	await nextPaint(page);
	return drag;
}

export async function expectSheetTopNear(page: Page, want: number, what: string, tolerance = 2) {
	const got = await sheetTop(page);
	expect(
		Math.abs(got - want),
		`${what}: got the sheet top at ${got}px, want ${want}px`
	).toBeLessThanOrEqual(tolerance);
}

// FB-2 review: the sheet's top edge sampled every animation frame, so a
// one-frame bounce between a release and the next state shows up.
type TopSamplerWindow = { __sheetTops: number[]; __sheetTopSampling: boolean };

export async function startTopSampling(page: Page) {
	await regionSheet(page).evaluate((el) => {
		const w = window as unknown as TopSamplerWindow;
		w.__sheetTops = [];
		w.__sheetTopSampling = true;
		const sample = () => {
			if (!w.__sheetTopSampling) return;
			w.__sheetTops.push(el.getBoundingClientRect().top);
			requestAnimationFrame(sample);
		};
		sample();
	});
}

export async function stopTopSampling(page: Page): Promise<number[]> {
	return page.evaluate(() => {
		const w = window as unknown as TopSamplerWindow;
		w.__sheetTopSampling = false;
		return w.__sheetTops;
	});
}

// How far the top ever moved back up from the lowest point it had reached
// (a larger top is lower on screen), and in which frame.
export function largestRise(tops: number[]): { rise: number; frame: number } {
	let lowest = -Infinity;
	let worst = { rise: 0, frame: -1 };
	tops.forEach((top, frame) => {
		lowest = Math.max(lowest, top);
		if (lowest - top > worst.rise) worst = { rise: lowest - top, frame };
	});
	return worst;
}

// Holds every later request for the app's own files and data for `ms`, so a
// client navigation (the deselect's goto) lands late, as on a slow phone.
export async function delayAppRequests(page: Page, ms: number) {
	const appRequest = (url: URL) =>
		url.pathname.startsWith('/_app/') || url.pathname.endsWith('/__data.json');
	await page.route(appRequest, async (route) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
		await route.continue();
	});
}
