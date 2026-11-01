import { expect, type Locator, type Page } from '@playwright/test';
import { boxOf, bottom } from './home-e2e';

// FE-9 FB-5: a BottomSheet's content always ends inside the screen.
// Helpers for the Playwright spec sheet-end-padding.e2e.ts.

// "Some spacing" under the last row once scrolled to the end (FB-5: bottom
// padding = off-screen part + safe-area inset + spacing). The spec gives no
// number; the content's own bottom padding is 22px (RegionDetails,
// DishDetails), so 16px leaves room for any fix that keeps it.
const MIN_END_SPACING_PX = 16;

// Sub-pixel layout: an edge may round half a pixel either way.
const EDGE_TOLERANCE_PX = 0.5;

// BottomSheet's own scroller, the body below the handle (not a nested list
// inside the content). No test id yet, so its class, as a direct child.
export function sheetBody(sheet: Locator): Locator {
	return sheet.locator(':scope > .body');
}

// Scrolls the body as far down as it goes; returns how far it is from its
// end afterwards.
async function scrollSheetToEnd(body: Locator): Promise<number> {
	return body.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
		return el.scrollHeight - el.clientHeight - el.scrollTop;
	});
}

export async function expectScrolledToEnd(sheet: Locator) {
	const body = sheetBody(sheet);
	await expect(body, 'want the sheet body (its scroller)').toHaveCount(1);
	const left = await scrollSheetToEnd(body);
	expect(left, `got the sheet ${left}px from its scroll end, want 0`).toBeLessThanOrEqual(
		EDGE_TOLERANCE_PX
	);
}

// The visual viewport's bottom edge, in the page's client coordinates.
export async function visualViewportBottom(page: Page): Promise<number> {
	return page.evaluate(() => {
		const view = window.visualViewport;
		return view ? view.offsetTop + view.height : window.innerHeight;
	});
}

// The row's whole box sits inside the visual viewport, with at least
// MIN_END_SPACING_PX between its bottom and the screen's bottom edge.
export async function expectFullyOnScreen(page: Page, row: Locator, what: string) {
	const box = await boxOf(row, what);
	const screenBottom = await visualViewportBottom(page);
	const limit = screenBottom - MIN_END_SPACING_PX;
	expect(box.y, `got ${what} top at ${box.y}px, want ≥ 0`).toBeGreaterThanOrEqual(
		-EDGE_TOLERANCE_PX
	);
	expect(
		bottom(box),
		`got ${what} bottom at ${bottom(box)}px, want ≤ ${limit}px ` +
			`(screen bottom ${screenBottom}px − ${MIN_END_SPACING_PX}px spacing)`
	).toBeLessThanOrEqual(limit + EDGE_TOLERANCE_PX);
}

// One animation frame during a sheet transition: the row's bottom edge and
// the body's scrollTop.
export type FrameSample = { rowBottom: number; scrollTop: number };

type SamplerWindow = { __sheetSamples: FrameSample[]; __sheetSampling: boolean };

// Records a FrameSample every animation frame until stopSampling, so a
// one-frame jump during the 450ms slide shows up.
export async function startSampling(body: Locator, row: Locator) {
	const rowHandle = await row.elementHandle();
	expect(rowHandle, 'got no row to sample').not.toBeNull();
	await body.evaluate((scroller, rowEl) => {
		const w = window as unknown as SamplerWindow;
		w.__sheetSamples = [];
		w.__sheetSampling = true;
		const sample = () => {
			if (!w.__sheetSampling) return;
			const rowBottom = rowEl!.getBoundingClientRect().bottom;
			w.__sheetSamples.push({ rowBottom, scrollTop: scroller.scrollTop });
			requestAnimationFrame(sample);
		};
		sample();
	}, rowHandle);
}

export async function stopSampling(page: Page): Promise<FrameSample[]> {
	return page.evaluate(() => {
		const w = window as unknown as SamplerWindow;
		w.__sheetSampling = false;
		return w.__sheetSamples;
	});
}

// Every sampled frame keeps the row's bottom on screen.
export function expectRowNeverBelow(samples: FrameSample[], screenBottom: number, what: string) {
	const worst = samples.findIndex((s) => s.rowBottom > screenBottom + EDGE_TOLERANCE_PX);
	const got = worst < 0 ? undefined : samples[worst].rowBottom;
	expect(
		worst,
		`got ${what} bottom at ${got}px in frame ${worst} of ${samples.length}, ` +
			`want ≤ ${screenBottom}px in every frame`
	).toBe(-1);
}

// No sampled frame scrolled the body back from where it was.
export function expectScrollKept(samples: FrameSample[], start: number) {
	const lowest = Math.min(...samples.map((s) => s.scrollTop));
	expect(
		lowest,
		`got the body scrolled to ${lowest}px during the slide, want it kept at ${start}px`
	).toBeGreaterThanOrEqual(start - EDGE_TOLERANCE_PX);
}
