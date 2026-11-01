import { expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import { boxOf, onlyVisible, type Box } from './home-e2e';

// Shared helpers for the sliding Regional | Popular switch (FE-9 FB-3,
// D-FE9-2): one thumb, data-testid="segment-thumb", per switch; the page has
// two switches (mobile header, desktop top bar), only one visible.

export type Point = { x: number; y: number };

// Pointer travel per move event: small enough that the gesture reads as a
// drag, not a jump, on every engine.
const STEP_PX = 8;

export const visibleThumb = (page: Page): Locator => onlyVisible(page.getByTestId('segment-thumb'));

export function visibleTab(page: Page, name: string): Locator {
	return onlyVisible(page.getByRole('tab', { name, exact: true }));
}

export function centre(box: Box): Point {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Waits until every animation and transition on the element has finished.
// A missing element fails as an assertion, not as a test timeout.
export async function settle(locator: Locator) {
	await expect(locator, 'want exactly one visible segment-thumb').toHaveCount(1);
	await locator.evaluate(async (el) => {
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
	});
}

// Two animation frames: what the page needs to paint after an input event.
export async function nextPaint(page: Page) {
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
}

export async function expectSameBox(got: Locator, want: Locator, what: string, tolerance = 0.5) {
	const [a, b] = [await boxOf(got, 'thumb'), await boxOf(want, 'active segment')];
	for (const side of ['x', 'y', 'width', 'height'] as const) {
		expect(
			Math.abs(a[side] - b[side]),
			`${what}: got thumb ${side} ${a[side]}px, want the segment's ${b[side]}px`
		).toBeLessThanOrEqual(tolerance);
	}
}

function steps(from: Point, to: Point): Point[] {
	const count = Math.max(1, Math.ceil(Math.abs(to.x - from.x) / STEP_PX));
	return Array.from({ length: count }, (_, i) => ({
		x: from.x + ((to.x - from.x) * (i + 1)) / count,
		y: from.y + ((to.y - from.y) * (i + 1)) / count
	}));
}

// A real touch gesture (Chromium only: CDP Input.dispatchTouchEvent), so the
// browser's own touch-action and pointercancel rules apply.
export class TouchDrag {
	private at: Point;
	private readonly cdp: CDPSession;

	private constructor(cdp: CDPSession, start: Point) {
		this.cdp = cdp;
		this.at = start;
	}

	static async start(page: Page, at: Point): Promise<TouchDrag> {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
		return new TouchDrag(cdp, at);
	}

	async moveTo(to: Point) {
		for (const point of steps(this.at, to)) {
			await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
		}
		this.at = to;
	}

	async end() {
		await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await this.cdp.detach();
	}
}

// A mouse drag (pointerType "mouse"), which every engine Playwright drives
// supports, WebKit on the iPhone profile included.
export async function mouseDrag(page: Page, from: Point, to: Point) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	for (const point of steps(from, to)) await page.mouse.move(point.x, point.y);
	await page.mouse.up();
}
