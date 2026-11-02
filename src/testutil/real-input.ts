import { cdp } from 'vitest/browser';

// Real (trusted) mouse and touch input for browser-mode specs, through CDP
// (Chromium). Coordinates are the test document's CSS pixels; Vitest shows
// that document in a scaled iframe, so they are mapped to the top page.

import { pathPoints, sendPaced, type Pace, type Point } from './gesture-path';

export type { Pace, Point };

// Travel per move event, in the test document's pixels.
const STEP_PX = 5;

function toPage(point: Point): Point {
	const frame = window.frameElement?.getBoundingClientRect();
	if (!frame) return point;
	const scale = frame.width / window.innerWidth;
	return { x: frame.left + point.x * scale, y: frame.top + point.y * scale };
}

function path(from: Point, to: Point, stepPx = STEP_PX): Point[] {
	return pathPoints(from, to, stepPx);
}

type MouseType = 'mouseMoved' | 'mousePressed' | 'mouseReleased';
type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';

function mouse(type: MouseType, at: Point, pressed: boolean) {
	const { x, y } = toPage(at);
	const button = type === 'mouseMoved' && !pressed ? 'none' : 'left';
	return cdp().send('Input.dispatchMouseEvent', {
		type,
		x,
		y,
		button,
		buttons: pressed ? 1 : 0,
		clickCount: type === 'mouseMoved' ? 0 : 1
	});
}

// A left-button press at `from`, moves to each point of `via`, release at
// the last one (or at `from`). The browser fires its own click after it.
export async function mouseDrag(from: Point, ...via: Point[]) {
	await mouse('mouseMoved', from, false);
	await mouse('mousePressed', from, true);
	let at = from;
	for (const target of via) {
		for (const point of path(at, target)) await mouse('mouseMoved', point, true);
		at = target;
	}
	await mouse('mouseReleased', at, false);
}

// The parts of a mouse drag, for checks while the button is down.
export const realMouse = {
	press: async (at: Point) => {
		await mouse('mouseMoved', at, false);
		await mouse('mousePressed', at, true);
	},
	move: (from: Point, to: Point, pace: Pace = {}) =>
		sendPaced(path(from, to, pace.stepPx), pace, (point) => mouse('mouseMoved', point, true)),
	// Moves with no button held (a hover).
	hover: (from: Point, to: Point) =>
		sendPaced(path(from, to), {}, (point) => mouse('mouseMoved', point, false)),
	release: (at: Point) => mouse('mouseReleased', at, false)
};

function touch(type: TouchType, points: Point[]) {
	return cdp().send('Input.dispatchTouchEvent', { type, touchPoints: points.map(toPage) });
}

// A one-finger drag; a moved touch fires no click. Pair with
// afterEach(disableTouch).
export async function touchDrag(from: Point, to: Point) {
	await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
	await touch('touchStart', [from]);
	for (const point of path(from, to)) await touch('touchMove', [point]);
	await touch('touchEnd', []);
}

// The parts of a one-finger gesture, for checks while the finger is down
// and for paced or flicked travel. Pair with afterEach(disableTouch).
export const realTouch = {
	start: async (at: Point) => {
		await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
		await touch('touchStart', [at]);
	},
	move: (from: Point, to: Point, pace: Pace = {}) =>
		sendPaced(path(from, to, pace.stepPx), pace, (point) => touch('touchMove', [point])),
	end: () => touch('touchEnd', [])
};

export function disableTouch() {
	return cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
}

export function centreOf(el: Element): Point {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
