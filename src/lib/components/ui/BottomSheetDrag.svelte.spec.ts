import type { Snippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	centreOf,
	disableTouch,
	realMouse,
	realTouch,
	type Pace,
	type Point
} from '../../../testutil/real-input';
import {
	CONTENT_TEST_ID,
	TALL_CONTENT_HTML,
	belowRest,
	content,
	contentRoot,
	labelled,
	screenFrame,
	scrollerOf,
	settle,
	transitionRunning
} from '../../../testutil/sheet';
import {
	animates,
	emulateReducedMotion,
	loadUi,
	resetEmulatedMedia,
	stage,
	useViewport
} from '../../../testutil/ui';

// FE-9 FB-2, spec addition D-FE9-1 (owner, 2026-11-01), and FB-5's
// scroll-to-expand, on BottomSheet with real (trusted) input through CDP:
// - "Pointer drag on the handle and header. The sheet follows the finger
//   (no transition while dragging)." Clamped: never above expanded; down
//   freely.
// - "On release, it snaps: up from peek → expanded; down from expanded →
//   peek; down from peek → hidden" (reported through onStateChange; the
//   screen deselects, as for the scrim). "Threshold 80 px, or a fast flick;
//   otherwise it snaps back."
// - "Dragging inside the scrollable content scrolls it. Tap-to-toggle,
//   keyboard and screen-reader behaviour stay as they are."
// - FB-5: "Scrolling up on the content in peek expands the sheet first, then
//   scrolls": while the sheet is in peek its content never scrolls.
// - Reduced motion: the slide is a fade, but the drag still works.
//
// The header drag is checked end to end (home-sheet-drag.e2e.ts): the header
// is the screen's content (RegionDetails), not BottomSheet's own markup.
// Unpinned: a downward swipe on the content at scrollTop 0 while expanded
// (native sheets drag the sheet down; either outcome passes here).

type SheetState = 'hidden' | 'peek' | 'expanded';
type BottomSheetProps = {
	state: SheetState;
	onStateChange: (next: SheetState) => void;
	label: string;
	handleLabel: string;
	contentKey?: unknown;
	children: Snippet;
};

const LABEL = 'Galicia';
// contentKey: the region shown, and another one opened later.
const FIRST_KEY = 'gal';
const OTHER_KEY = 'and';
const HANDLE_LABEL = 'Expand';
// Resting offsets at 390×844 (D-FE3-1): expanded 0, peek 640 − 310.
const PEEK_OFFSET = 330;
// Past the 80px threshold, and under it.
const LONG_DRAG_PX = 120;
const SHORT_DRAG_PX = 40;
const FOLLOW_PX = 100;
// Far past the peek position, to show "down freely".
const FAR_DOWN_PX = 400;
// Live position read back after a frame; allows sub-pixel rounding.
const FOLLOW_TOLERANCE_PX = 1.5;
// Above the sheet in every state at 390×844 (expanded top: 204).
const ABOVE_SHEET_Y = 100;
// Slow: 4px every 40ms (0.1 px/ms, far under the flick speed, and only
// slower on a loaded machine).
const SLOW: Pace = { stepPx: 4, pauseMs: 40 };
// A flick: one 70px event (under the 80px threshold, so only its speed can
// snap it). The speed is measured from the press, so it stays ≥ 0.7 px/ms
// however slow CDP gets, up to the 100ms velocity window. Up from the handle
// in peek, that one event lands above the sheet, on the scrim: the sheet must
// keep the pointer from the press on (review finding, lost mouse release).
const FLICK_PX = 70;
const FLICK: Pace = { stepPx: FLICK_PX };
// One mouse event from the handle in peek to the scrim above the sheet.
const JUMP_OUT_PX = 40;
// Content swipes: long enough for the browser to scroll, at finger speed.
const SWIPE_PX = 200;
// Down from the peek content's middle: past 80px, still inside the frame.
const PEEK_DOWN_SWIPE_PX = 90;
const SWIPE: Pace = { stepPx: 10, pauseMs: 16 };

type Fixture = {
	frame: HTMLElement;
	sheet: HTMLElement;
	handle: HTMLElement;
	body: HTMLElement;
	onStateChange: ReturnType<typeof vi.fn<(next: SheetState) => void>>;
	rerender: (next: Partial<BottomSheetProps>) => Promise<void>;
};

// `follow`: the screen applies every asked-for state (so a snap is seen);
// otherwise the state stays where it was and only the request is recorded.
type RenderOptions = {
	// The screen applies every asked-for state (so a snap is seen); otherwise
	// the state stays where it was and only the request is recorded.
	follow?: boolean;
	// The positioned frame the sheet rests in (default: the whole viewport).
	frame?: () => HTMLElement;
	// The sheet's content (default: TALL_CONTENT_HTML).
	html?: string;
};

async function renderSheet(state: SheetState, options: RenderOptions = {}): Promise<Fixture> {
	const BottomSheet = await loadUi<BottomSheetProps>('BottomSheet');
	const frame = (options.frame ?? screenFrame)();
	const onStateChange = vi.fn<(next: SheetState) => void>();
	const props = { state, onStateChange, label: LABEL, handleLabel: HANDLE_LABEL };
	const result = await render(BottomSheet, {
		target: frame,
		props: { ...props, contentKey: FIRST_KEY, children: content(options.html ?? TALL_CONTENT_HTML) }
	});
	const rerender = (next: Partial<BottomSheetProps>) => result.rerender(next);
	if (options.follow) onStateChange.mockImplementation((next) => void rerender({ state: next }));
	const sheet = labelled(frame, LABEL);
	settle();
	const body = scrollerOf(contentRoot(sheet), sheet);
	const handle = labelled(sheet, HANDLE_LABEL);
	return { frame, sheet, handle, body, onStateChange, rerender };
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Lets the input task that ended a gesture (and its click) finish.
async function afterGesture() {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	await nextFrame();
	await nextFrame();
}

// An earlier fast touch gesture (the flicks) leaves Chromium's gesture
// detector flinging, and the next tap only stops the fling, with no click
// (as on a phone). A tap above the sheet stops any such fling; whatever it
// asks for (the scrim) is then forgotten.
async function stopAnyFling(f: Fixture) {
	const above = { x: centreOf(f.handle).x, y: ABOVE_SHEET_Y };
	await touchDrag(above, 0);
	f.onStateChange.mockClear();
}

const shifted = (point: Point, dy: number): Point => ({ x: point.x, y: point.y + dy });

async function mouseDragHandle(f: Fixture, dy: number, pace: Pace = {}) {
	const from = centreOf(f.handle);
	await realMouse.press(from);
	await realMouse.move(from, shifted(from, dy), pace);
	await realMouse.release(shifted(from, dy));
	await afterGesture();
}

async function touchDrag(from: Point, dy: number, pace: Pace = {}) {
	await realTouch.start(from);
	await realTouch.move(from, shifted(from, dy), pace);
	await realTouch.end();
	await afterGesture();
}

function expectOffset(f: Fixture, want: number, what: string) {
	const got = belowRest(f.sheet, f.frame);
	expect(
		Math.abs(got - want),
		`${what}: got the sheet ${got}px below its rest, want ${want}px`
	).toBeLessThanOrEqual(FOLLOW_TOLERANCE_PX);
}

function expectRequests(f: Fixture, want: SheetState[], what: string) {
	const got = f.onStateChange.mock.calls.map(([next]) => next);
	expect(
		got,
		`${what}: got onStateChange ${JSON.stringify(got)}, want ${JSON.stringify(want)}`
	).toEqual(want);
}

// A point in the content's visible part, below the handle, for each state.
function contentPoint(f: Fixture): Point {
	const handle = f.handle.getBoundingClientRect();
	const visibleBottom = f.frame.getBoundingClientRect().bottom;
	return { x: handle.left + handle.width / 2, y: (handle.bottom + visibleBottom) / 2 + 40 };
}

afterEach(async () => {
	await disableTouch();
	await resetEmulatedMedia();
});

describe('BottomSheet handle drag: the sheet follows the pointer', () => {
	useViewport(390, 844);

	it('moves up with the pointer from peek, with no transition', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, -FOLLOW_PX));
		await nextFrame();
		expect(transitionRunning(f.sheet, 'transform'), 'got a transform transition mid-drag').toBe(
			false
		);
		expectOffset(f, PEEK_OFFSET - FOLLOW_PX, 'mid-drag up from peek');
		await realMouse.release(shifted(from, -FOLLOW_PX));
	});

	it('moves down with the pointer from peek, with no transition', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, FOLLOW_PX));
		await nextFrame();
		expect(transitionRunning(f.sheet, 'transform'), 'got a transform transition mid-drag').toBe(
			false
		);
		expectOffset(f, PEEK_OFFSET + FOLLOW_PX, 'mid-drag down from peek');
		await realMouse.release(shifted(from, FOLLOW_PX));
	});

	it('stops at the expanded position when dragged up past it', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, -(PEEK_OFFSET + 100)));
		await nextFrame();
		expectOffset(f, 0, 'dragged above the expanded position');
		await realMouse.release(shifted(from, -(PEEK_OFFSET + 100)));
	});

	it('stays put when dragged up from expanded', async () => {
		const f = await renderSheet('expanded');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, -60));
		await nextFrame();
		expectOffset(f, 0, 'dragged up from expanded');
		await realMouse.release(shifted(from, -60));
	});

	it('follows the pointer down from expanded past the peek position', async () => {
		const f = await renderSheet('expanded');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, FAR_DOWN_PX));
		await nextFrame();
		expectOffset(f, FAR_DOWN_PX, 'dragged far down from expanded');
		await realMouse.release(shifted(from, FAR_DOWN_PX));
	});

	it('follows a finger too (touch on the handle)', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		await realTouch.start(from);
		await realTouch.move(from, shifted(from, -FOLLOW_PX));
		await nextFrame();
		expectOffset(f, PEEK_OFFSET - FOLLOW_PX, 'mid touch drag up from peek');
		await realTouch.end();
	});
});

describe('BottomSheet handle drag: release snaps', () => {
	useViewport(390, 844);

	const cases: { name: string; from: SheetState; dy: number; pace: Pace; want: SheetState[] }[] = [
		{
			name: 'up 120px from peek → expanded',
			from: 'peek',
			dy: -LONG_DRAG_PX,
			pace: {},
			want: ['expanded']
		},
		{
			name: 'down 120px from expanded → peek',
			from: 'expanded',
			dy: LONG_DRAG_PX,
			pace: {},
			want: ['peek']
		},
		{
			name: 'down 120px from peek → hidden',
			from: 'peek',
			dy: LONG_DRAG_PX,
			pace: {},
			want: ['hidden']
		},
		{
			name: 'a slow 40px drag up from peek snaps back',
			from: 'peek',
			dy: -SHORT_DRAG_PX,
			pace: SLOW,
			want: []
		},
		{
			name: 'a slow 40px drag down from peek snaps back',
			from: 'peek',
			dy: SHORT_DRAG_PX,
			pace: SLOW,
			want: []
		},
		{
			name: 'a slow 40px drag down from expanded snaps back',
			from: 'expanded',
			dy: SHORT_DRAG_PX,
			pace: SLOW,
			want: []
		},
		{
			name: 'a fast 70px flick up from peek → expanded',
			from: 'peek',
			dy: -FLICK_PX,
			pace: FLICK,
			want: ['expanded']
		},
		{
			name: 'a fast 70px flick down from peek → hidden',
			from: 'peek',
			dy: FLICK_PX,
			pace: FLICK,
			want: ['hidden']
		},
		{
			name: 'a fast 70px flick down from expanded → peek',
			from: 'expanded',
			dy: FLICK_PX,
			pace: FLICK,
			want: ['peek']
		}
	];

	// Exactly the drag's request: the mouse release over the handle (which
	// moved with the pointer) must not also toggle it.
	for (const { name, from, dy, pace, want } of cases) {
		it(`mouse: ${name}`, async () => {
			const f = await renderSheet(from);
			await mouseDragHandle(f, dy, pace);
			expectRequests(f, want, name);
		});

		it(`touch: ${name}`, async () => {
			const f = await renderSheet(from);
			await touchDrag(centreOf(f.handle), dy, pace);
			expectRequests(f, want, name);
		});
	}

	it('comes to rest at the new state once the screen applies it', async () => {
		const f = await renderSheet('peek', { follow: true });
		await mouseDragHandle(f, -LONG_DRAG_PX);
		settle();
		expectOffset(f, 0, 'after an up drag from peek, applied');
		expect(f.sheet.getAttribute('data-state')).toBe('expanded');
	});

	it('snaps back to its resting place, animated, after a short drag', async () => {
		const f = await renderSheet('peek');
		await mouseDragHandle(f, -SHORT_DRAG_PX, SLOW);
		expect(animates(f.sheet, 'transform'), 'want the 450ms transform back after release').toBe(
			true
		);
		settle();
		expectOffset(f, PEEK_OFFSET, 'after snapping back');
	});
});

// Review finding (major): the sheet took the pointer only after the slop,
// so a mouse whose first move left the sheet lost both the move and the
// release, and the stale press then dragged the sheet on a plain hover.
describe('BottomSheet mouse press whose first move leaves the sheet', () => {
	useViewport(390, 844);

	it('a one-event flick from the handle onto the scrim still expands it, once', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		const out = shifted(from, -JUMP_OUT_PX);
		expect(out.y, 'want the jump to land above the peek sheet').toBeLessThan(
			f.sheet.getBoundingClientRect().top
		);
		await realMouse.press(from);
		await realMouse.move(from, out, { stepPx: JUMP_OUT_PX });
		await realMouse.release(out);
		await afterGesture();
		expectRequests(f, ['expanded'], 'one-event flick onto the scrim');
	});

	it('after that press and release, hovering with no button never moves the sheet', async () => {
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		const out = shifted(from, -JUMP_OUT_PX);
		await realMouse.press(from);
		await realMouse.move(from, out, { stepPx: JUMP_OUT_PX });
		await realMouse.release(out);
		await afterGesture();
		settle();
		await realMouse.hover(out, shifted(from, FOLLOW_PX));
		await nextFrame();
		expectOffset(f, PEEK_OFFSET, 'after hovering over the sheet with no button');
	});
});

describe('BottomSheet handle tap still toggles', () => {
	useViewport(390, 844);

	it('a real mouse click on the handle in peek asks for expanded, once', async () => {
		const f = await renderSheet('peek');
		const at = centreOf(f.handle);
		await realMouse.press(at);
		await realMouse.release(at);
		await afterGesture();
		expectRequests(f, ['expanded'], 'mouse click on the handle');
	});

	it('a real mouse click on the handle in expanded asks for peek, once', async () => {
		const f = await renderSheet('expanded');
		const at = centreOf(f.handle);
		await realMouse.press(at);
		await realMouse.release(at);
		await afterGesture();
		expectRequests(f, ['peek'], 'mouse click on the handle');
	});

	it('a real finger tap on the handle in peek asks for expanded, once', async () => {
		const f = await renderSheet('peek');
		await stopAnyFling(f);
		await touchDrag(centreOf(f.handle), 0);
		expectRequests(f, ['expanded'], 'finger tap on the handle');
	});
});

describe('BottomSheet content: swipes scroll, except in peek', () => {
	useViewport(390, 844);

	it('expanded: an upward swipe on the content scrolls it and leaves the sheet', async () => {
		const f = await renderSheet('expanded');
		await touchDrag(contentPoint(f), -SWIPE_PX, SWIPE);
		expect(f.body.scrollTop, 'want the content scrolled by the swipe').toBeGreaterThan(0);
		expectRequests(f, [], 'swipe on expanded content');
		settle();
		expectOffset(f, 0, 'after a swipe on expanded content');
	});

	it('peek: an upward swipe on the content expands the sheet', async () => {
		const f = await renderSheet('peek');
		await touchDrag(contentPoint(f), -SWIPE_PX, SWIPE);
		expectRequests(f, ['expanded'], 'upward swipe on peek content');
	});

	// Accepted behaviour (coordinator, FB-2 follow-up): in peek the content
	// drags like the handle, so a downward swipe hides the sheet (the screen
	// deselects, as for the scrim).
	it('peek: a downward swipe on the content asks for hidden', async () => {
		const f = await renderSheet('peek');
		await touchDrag(contentPoint(f), PEEK_DOWN_SWIPE_PX, SLOW);
		expectRequests(f, ['hidden'], 'downward swipe on peek content');
	});

	it('peek: the content does not scroll while the sheet is in peek', async () => {
		const f = await renderSheet('peek');
		await touchDrag(contentPoint(f), -SWIPE_PX, SWIPE);
		expect(f.body.scrollTop, 'got the peek content scrolled; want the sheet to expand first').toBe(
			0
		);
	});

	it('peek → expanded by a content swipe, then the next swipe scrolls', async () => {
		const f = await renderSheet('peek', { follow: true });
		await touchDrag(contentPoint(f), -SWIPE_PX, SWIPE);
		settle();
		expect(f.sheet.getAttribute('data-state'), 'want the first swipe to expand').toBe('expanded');
		await touchDrag(contentPoint(f), -SWIPE_PX, SWIPE);
		expect(f.body.scrollTop, 'want the second swipe to scroll the content').toBeGreaterThan(0);
		expect(f.sheet.getAttribute('data-state')).toBe('expanded');
	});
});

describe('BottomSheet drag under prefers-reduced-motion: reduce', () => {
	useViewport(390, 844);

	it('still follows the pointer', async () => {
		await emulateReducedMotion('reduce');
		const f = await renderSheet('peek');
		const from = centreOf(f.handle);
		await realMouse.press(from);
		await realMouse.move(from, shifted(from, -FOLLOW_PX));
		await nextFrame();
		expectOffset(f, PEEK_OFFSET - FOLLOW_PX, 'mid-drag under reduced motion');
		await realMouse.release(shifted(from, -FOLLOW_PX));
	});

	it('still snaps on release: down from peek → hidden', async () => {
		await emulateReducedMotion('reduce');
		const f = await renderSheet('peek');
		await mouseDragHandle(f, LONG_DRAG_PX);
		expectRequests(f, ['hidden'], 'drag down under reduced motion');
	});
});

// FB-2 re-review (major, stuck hold): a drag released to hidden holds the
// sheet where it was let go until the screen hides it. If the screen opens
// other content instead (another region while the close is pending, or
// during the reduced-motion fade), the sheet must rest at its state's place,
// not at the old drag offset.
describe('BottomSheet held offset after a drag to hidden', () => {
	useViewport(390, 844);

	it('new content while the hide is pending rests at peek', async () => {
		const f = await renderSheet('peek');
		await mouseDragHandle(f, LONG_DRAG_PX, SLOW);
		expectRequests(f, ['hidden'], 'drag down from peek');
		await f.rerender({ contentKey: OTHER_KEY });
		await nextFrame();
		settle();
		expectOffset(f, PEEK_OFFSET, 'another region opened while the hide was pending');
		expect(f.sheet.style.transform, 'got an inline transform left over').toBe('');
	});

	it('under reduced motion, reopening during the fade rests at peek', async () => {
		await emulateReducedMotion('reduce');
		const f = await renderSheet('peek', { follow: true });
		await mouseDragHandle(f, LONG_DRAG_PX, SLOW);
		expectRequests(f, ['hidden'], 'drag down from peek');
		await f.rerender({ state: 'peek', contentKey: OTHER_KEY });
		await nextFrame();
		settle();
		expect(f.sheet.getAttribute('data-state')).toBe('peek');
		expectOffset(f, PEEK_OFFSET, 'another region opened during the fade');
		expect(f.sheet.style.transform, 'got an inline transform left over').toBe('');
	});
});

// FB-2 re-review (minor, slide-off cancel; main's behaviour before FB-2):
// a press that leaves the pressed control without dragging and is released
// away from it is no activation. The handle spans the sheet, so the sheet
// rests in a frame narrower than the page and the press slides off sideways
// (no vertical travel, so never a drag).
describe('BottomSheet handle press released off it', () => {
	useViewport(390, 844);
	const NARROW_FRAME_PX = 300;
	const narrowFrame = () =>
		stage(
			`position: fixed; left: 0; top: 0; bottom: 0; width: ${NARROW_FRAME_PX}px; overflow: hidden`
		);

	it('a mouse press on the handle released beside the sheet does not toggle', async () => {
		const f = await renderSheet('peek', { frame: narrowFrame });
		const from = centreOf(f.handle);
		const away = { x: NARROW_FRAME_PX + 50, y: from.y };
		expect(f.handle.contains(document.elementFromPoint(away.x, away.y)), 'want away off it').toBe(
			false
		);
		await realMouse.press(from);
		await realMouse.move(from, away);
		await realMouse.release(away);
		await afterGesture();
		expectRequests(f, [], 'press slid off the handle');
	});
});

// Bug (FB-2, tap jitter inside a control): in peek the sheet takes every
// press, and a tap that lands on a child of a control (a row's name, the
// handle's bar) and lifts a few px later on another part of the same control
// (the row's description or padding, the handle's padding) is still a tap
// on that control: its click must land, once. Only a release off the
// control cancels (see "handle press released off it" above).
describe('BottomSheet peek: a tap that jitters within the pressed control', () => {
	useViewport(390, 844);
	// Under the 4px drag slop.
	const JITTER_PX = 3;
	const ROW_HTML =
		`<div data-testid="${CONTENT_TEST_ID}">` +
		'<a href="#row" data-testid="row" style="display: block; padding: 8px 16px">' +
		'<span class="name" style="display: block; height: 20px">Tortilla de Betanzos</span>' +
		'<span class="description" style="display: block; height: 20px">Runny centre</span>' +
		'</a><div style="height: 1200px"></div></div>';

	type Row = { link: HTMLElement; name: HTMLElement; description: HTMLElement; clicks: boolean[] };

	// The row link, with every click that reaches it (whether it was
	// prevented); the hash navigation itself is prevented afterwards.
	function rowOf(f: Fixture): Row {
		const link = f.sheet.querySelector<HTMLElement>('[data-testid="row"]')!;
		const clicks: boolean[] = [];
		link.addEventListener('click', (event) => {
			clicks.push(event.defaultPrevented);
			event.preventDefault();
		});
		const name = link.querySelector<HTMLElement>('.name')!;
		const description = link.querySelector<HTMLElement>('.description')!;
		return { link, name, description, clicks };
	}

	// Just above the bottom edge of `el`, so a JITTER_PX move leaves it.
	function nearBottomOf(el: Element): Point {
		const r = el.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.bottom - 1 };
	}

	function expectUnder(el: Element, at: Point, what: string) {
		const hit = document.elementFromPoint(at.x, at.y);
		expect(hit, `${what}: got <${hit?.tagName.toLowerCase()}> under the point`).toBe(el);
	}

	async function mouseTap(from: Point, to: Point) {
		await realMouse.press(from);
		await realMouse.move(from, to);
		await realMouse.release(to);
		await afterGesture();
	}

	function expectOneClick(row: Row, what: string) {
		const got = JSON.stringify(row.clicks);
		expect(row.clicks, `${what}: got clicks ${got} on the row link, want [false]`).toEqual([false]);
	}

	it("control: a click on the row's name follows the link, once", async () => {
		const f = await renderSheet('peek', { html: ROW_HTML });
		const row = rowOf(f);
		const at = centreOf(row.name);
		await mouseTap(at, at);
		expectOneClick(row, 'click on the name');
		expectRequests(f, [], 'click on a row');
	});

	it("a press on the row's name released 3px lower on its description follows the link", async () => {
		const f = await renderSheet('peek', { html: ROW_HTML });
		const row = rowOf(f);
		const from = nearBottomOf(row.name);
		const to = shifted(from, JITTER_PX);
		expectUnder(row.description, to, 'want the release on the description');
		await mouseTap(from, to);
		expectOneClick(row, 'name → description');
		expectRequests(f, [], 'tap on a row');
	});

	it("a press on the row's description released 3px lower on the row's padding follows the link", async () => {
		const f = await renderSheet('peek', { html: ROW_HTML });
		const row = rowOf(f);
		const from = nearBottomOf(row.description);
		const to = shifted(from, JITTER_PX);
		expectUnder(row.link, to, "want the release on the row's own padding");
		await mouseTap(from, to);
		expectOneClick(row, 'description → row padding');
	});

	// Passes today: the handle's ::before hit area paints over the bar, so a
	// press there already targets the button. Guards the toggle if that changes.
	it("a press on the handle's bar released 3px lower on the handle's padding toggles, once", async () => {
		const f = await renderSheet('peek');
		const bar = f.handle.querySelector('.bar');
		expect(bar, 'got no .bar inside the handle').not.toBeNull();
		const from = nearBottomOf(bar!);
		const to = shifted(from, JITTER_PX);
		expectUnder(f.handle, to, "want the release on the handle's padding");
		await mouseTap(from, to);
		expectRequests(f, ['expanded'], 'bar → handle padding');
	});
});

// FB-2 re-review (minor): a move with the primary button up means the
// release was lost (synthetic events: a real press is captured, so its
// release can't be lost). The stale press must end there, so a later press
// that the sheet doesn't take (expanded content isn't a drag zone) can't
// drag it with the old press's start. Fails if the `buttons` check goes.
describe('BottomSheet press whose release was lost', () => {
	useViewport(390, 844);
	const PRIMARY_BUTTONS = 1;

	function mousePointer(type: string, target: Element, at: Point, buttons: number) {
		const init = { bubbles: true, cancelable: true, composed: true, isPrimary: true };
		const button = type === 'pointermove' ? -1 : 0;
		const where = { clientX: at.x, clientY: at.y };
		const id = { pointerId: 1, pointerType: 'mouse', button, buttons };
		target.dispatchEvent(new PointerEvent(type, { ...init, ...where, ...id }));
	}

	it('a stale press ends on a buttonless move; a later untaken press drags nothing', async () => {
		const f = await renderSheet('expanded');
		const from = centreOf(f.handle);
		mousePointer('pointerdown', f.handle, from, PRIMARY_BUTTONS);
		mousePointer('pointermove', f.handle, from, 0);
		const inContent = contentPoint(f);
		const below = f.body.ownerDocument.elementFromPoint(inContent.x, inContent.y) ?? f.body;
		mousePointer('pointerdown', below, inContent, PRIMARY_BUTTONS);
		mousePointer('pointermove', below, shifted(inContent, FOLLOW_PX), PRIMARY_BUTTONS);
		await nextFrame();
		expectOffset(f, 0, 'after a press the sheet did not take');
		mousePointer('pointerup', below, shifted(inContent, FOLLOW_PX), 0);
	});

	it('control: the same synthetic press does drag the sheet', async () => {
		const f = await renderSheet('expanded');
		const from = centreOf(f.handle);
		mousePointer('pointerdown', f.handle, from, PRIMARY_BUTTONS);
		mousePointer('pointermove', f.handle, shifted(from, FOLLOW_PX), PRIMARY_BUTTONS);
		await nextFrame();
		expectOffset(f, FOLLOW_PX, 'synthetic drag of the handle');
		mousePointer('pointerup', f.handle, shifted(from, FOLLOW_PX), 0);
	});
});
