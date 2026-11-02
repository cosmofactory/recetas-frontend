import { cdp } from 'vitest/browser';

// Real (trusted) mouse and touch input for browser-mode specs, through CDP
// (Chromium). Coordinates are the test document's CSS pixels; Vitest shows
// that document in a scaled iframe, so they are mapped to the top page.

import { pathPoints, sendPaced, type Pace, type Point } from './gesture-path';

export type { Pace, Point };

// Travel per move event, in the test document's pixels.
const STEP_PX = 5;
const MS_PER_SECOND = 1000;

// A gesture paced in event time, not wall time: each event carries a CDP
// `timestamp` (which becomes the page's event.timeStamp) `msPerStep` after
// the one before, so the speed the page measures doesn't depend on how fast
// the runner delivers the events. A slow CI runner can take over 100ms per
// CDP call, which turned a flick into a pause.
export type Timing = { stepPx: number; msPerStep: number };

// Event times (CDP: seconds since the epoch) for `count` events from now,
// `msPerStep` apart.
function eventTimes(count: number, msPerStep: number): number[] {
	const start = Date.now();
	return Array.from({ length: count }, (_, i) => (start + i * msPerStep) / MS_PER_SECOND);
}

// Waits until the wall clock has passed the gesture's last stamp, so later
// (unstamped) input never goes back in time.
async function catchUpWith(times: number[]) {
	const lastMs = (times.at(-1) ?? 0) * MS_PER_SECOND;
	const ahead = lastMs - Date.now();
	if (ahead > 0) await new Promise<void>((resolve) => setTimeout(resolve, ahead));
}

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

// `timestamp`: the event's time (seconds since the epoch), else now.
function mouse(type: MouseType, at: Point, pressed: boolean, timestamp?: number) {
	const { x, y } = toPage(at);
	const button = type === 'mouseMoved' && !pressed ? 'none' : 'left';
	return cdp().send('Input.dispatchMouseEvent', {
		type,
		x,
		y,
		button,
		buttons: pressed ? 1 : 0,
		clickCount: type === 'mouseMoved' ? 0 : 1,
		timestamp
	});
}

// A press at `from`, moves to `to`, the release there: one Timing step apart.
async function timedMouseDrag(from: Point, to: Point, timing: Timing) {
	const points = path(from, to, timing.stepPx);
	const times = eventTimes(points.length + 2, timing.msPerStep);
	await mouse('mouseMoved', from, false, times[0]);
	await mouse('mousePressed', from, true, times[0]);
	for (const [i, point] of points.entries()) await mouse('mouseMoved', point, true, times[i + 1]);
	await mouse('mouseReleased', to, false, times.at(-1));
	await catchUpWith(times);
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
	release: (at: Point) => mouse('mouseReleased', at, false),
	// The whole drag (press, moves, release), paced in event time.
	timedDrag: timedMouseDrag
};

// Touch goes in without Emulation.setTouchEmulationEnabled: Chromium
// delivers it as pointerType "touch" (and touch events) anyway, and turning
// emulation on leaves `(hover: hover)` false in that page even after it is
// turned off again. Vitest reuses a page for later spec files, so their
// hover-styled checks then failed at random.
function touch(type: TouchType, points: Point[], timestamp?: number) {
	const touchPoints = points.map(toPage);
	return cdp().send('Input.dispatchTouchEvent', { type, touchPoints, timestamp });
}

// A finger down at `from`, moves to `to`, lifted there: one Timing step apart.
async function timedTouchDrag(from: Point, to: Point, timing: Timing) {
	const points = path(from, to, timing.stepPx);
	const times = eventTimes(points.length + 2, timing.msPerStep);
	await touch('touchStart', [from], times[0]);
	for (const [i, point] of points.entries()) await touch('touchMove', [point], times[i + 1]);
	await touch('touchEnd', [], times.at(-1));
	await catchUpWith(times);
}

// A one-finger drag; a moved touch fires no click.
export async function touchDrag(from: Point, to: Point) {
	await touch('touchStart', [from]);
	for (const point of path(from, to)) await touch('touchMove', [point]);
	await touch('touchEnd', []);
}

// The parts of a one-finger gesture, for checks while the finger is down
// and for paced or flicked travel.
export const realTouch = {
	start: (at: Point) => touch('touchStart', [at]),
	move: (from: Point, to: Point, pace: Pace = {}) =>
		sendPaced(path(from, to, pace.stepPx), pace, (point) => touch('touchMove', [point])),
	end: () => touch('touchEnd', []),
	// The whole gesture (down, moves, up), paced in event time.
	timedDrag: timedTouchDrag
};

export function centreOf(el: Element): Point {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
