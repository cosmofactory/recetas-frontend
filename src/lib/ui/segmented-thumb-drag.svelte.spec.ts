import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { loadUiExport, stage } from '../../testutil/ui';
import {
	centreOf,
	disableTouch,
	mouseDrag,
	realMouse,
	touchDrag,
	type Point
} from '../../testutil/real-input';

// FE-9 FB-3 (D-FE9-2): ThumbDrag (src/lib/ui/segmented-thumb-drag.svelte.ts)
// is the switch's drag logic. "The thumb can be dragged along the track; on
// release it snaps to the nearer segment and selects it. Tap still selects."
// - A press on the selected segment that travels past the slop (4px) is a
//   drag: `offset` follows the pointer; release snaps (snapIndex) and calls
//   `choose(index)` once when the segment differs. Less travel is a tap.
// - The drag's own click (a mouse release fires one) must not select again,
//   so the track's capture-phase click handler swallows it; a keyboard click
//   (detail 0) is a new activation and passes. The swallow belongs to that
//   one gesture: a long touch drag fires no click, and a later click must
//   not be eaten (review bug A).
// - `restingIndex` keeps the thumb on the drag-chosen segment until the
//   selection catches up (`forgetHeld`); a second finger or another button
//   pressing meanwhile must not drop it (review bug B: the thumb would jump
//   back while the navigation is pending).
// - pointercancel drops the drag: no offset, no choose.
//
// The fixture wires a ThumbDrag to a bare track exactly as SegmentedSwitch
// does, and drives it with real input (CDP), so clicks are trusted.

type Options = {
	tabs: () => HTMLElement[];
	selectedIndex: () => number;
	choose: (index: number) => void;
};
type ThumbDragLike = {
	offset: number | undefined;
	restingIndex: (selectedIndex: number) => number;
	forgetHeld: (selectedIndex: number) => void;
	start: (event: PointerEvent) => void;
	move: (event: PointerEvent) => void;
	end: (event: PointerEvent) => void;
	cancel: (event: PointerEvent) => void;
	clickAfterDrag: (event: MouseEvent) => void;
};
type ThumbDragClass = new (options: Options) => ThumbDragLike;

const MODULE = 'segmented-thumb-drag.svelte.ts';
// Under the slop: still a tap.
const JITTER_PX = 2;
const FOLLOW_PX = 40;
const OFFSET_TOLERANCE_PX = 1.5;

type Fixture = {
	drag: ThumbDragLike;
	tabs: HTMLButtonElement[];
	track: HTMLElement;
	choose: ReturnType<typeof vi.fn>;
	// Clicks that got past the track's capture phase, by tab index.
	clicksThrough: number[];
	select: (index: number) => void;
};

function buildTrack(): { track: HTMLElement; tabs: HTMLButtonElement[] } {
	const track = document.createElement('div');
	track.setAttribute(
		'style',
		'display: flex; gap: 4px; padding: 4px; width: 300px; touch-action: pan-y; user-select: none'
	);
	const tabs = ['Regional', 'Popular'].map((label) => {
		const tab = document.createElement('button');
		tab.type = 'button';
		tab.textContent = label;
		tab.setAttribute('style', 'flex: 1; min-width: 0; padding: 9px 0');
		track.append(tab);
		return tab;
	});
	stage().append(track);
	return { track, tabs };
}

function wire(track: HTMLElement, drag: ThumbDragLike) {
	track.addEventListener('pointerdown', drag.start);
	track.addEventListener('pointermove', drag.move);
	track.addEventListener('pointerup', drag.end);
	track.addEventListener('pointercancel', drag.cancel);
	track.addEventListener('click', drag.clickAfterDrag, { capture: true });
}

async function setUp(): Promise<Fixture> {
	const ThumbDrag = await loadUiExport<ThumbDragClass>(MODULE, 'ThumbDrag');
	const { track, tabs } = buildTrack();
	let selected = 0;
	const choose = vi.fn();
	const drag = new ThumbDrag({ tabs: () => tabs, selectedIndex: () => selected, choose });
	wire(track, drag);
	const clicksThrough: number[] = [];
	tabs.forEach((tab, i) => tab.addEventListener('click', () => clicksThrough.push(i)));
	return { drag, tabs, track, choose, clicksThrough, select: (i) => (selected = i) };
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Lets the input task that ended a gesture finish, and the page settle.
async function afterGesture() {
	await nextTask();
	await nextFrame();
}

function shifted(point: Point, dx: number): Point {
	return { x: point.x + dx, y: point.y };
}

// A synthetic press on the track (start() ignores isTrusted): a second
// finger, or a non-primary button.
function syntheticPress(target: HTMLElement, init: PointerEventInit) {
	const { x, y } = centreOf(target);
	const event = new PointerEvent('pointerdown', {
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
		...init
	});
	target.dispatchEvent(event);
}

// A trusted click (detail 1) whose press the track never saw: the press is
// stopped at the tab, the click still bubbles through the track. Stands in
// for a click that isn't the end of a press on the track (e.g. an
// assistive-technology activation).
async function clickWithoutTrackPress(tab: HTMLElement) {
	const stop = (event: Event) => event.stopPropagation();
	tab.addEventListener('pointerdown', stop);
	try {
		await mouseDrag(centreOf(tab));
	} finally {
		tab.removeEventListener('pointerdown', stop);
	}
}

afterEach(() => disableTouch());

describe('ThumbDrag: drag and release', () => {
	it('a drag from the selected segment to the other calls choose once with its index', async () => {
		const f = await setUp();
		await mouseDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		expect(f.choose.mock.calls, 'want choose(1) exactly once').toEqual([[1]]);
	});

	it('a touch drag to the other segment calls choose once with its index', async () => {
		const f = await setUp();
		await touchDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		await afterGesture();
		expect(f.choose.mock.calls, 'want choose(1) exactly once').toEqual([[1]]);
	});

	it(`a ${JITTER_PX}px wobble is a tap: no choose, and its click goes through`, async () => {
		const f = await setUp();
		const start = centreOf(f.tabs[0]);
		await mouseDrag(start, shifted(start, JITTER_PX));
		expect(f.choose, 'got choose for a tap').not.toHaveBeenCalled();
		expect(f.clicksThrough, 'want the tap click on Regional').toEqual([0]);
	});

	it('a drag released back near the start chooses nothing', async () => {
		const f = await setUp();
		const start = centreOf(f.tabs[0]);
		await mouseDrag(start, shifted(start, FOLLOW_PX), shifted(start, 10));
		expect(f.choose, 'got choose after snapping back').not.toHaveBeenCalled();
	});

	it('a press on the unselected segment does not drag the thumb', async () => {
		const f = await setUp();
		await mouseDrag(centreOf(f.tabs[1]), centreOf(f.tabs[0]));
		expect(f.choose, 'got choose from a press off the thumb').not.toHaveBeenCalled();
	});

	it('offset follows the pointer while the button is down, then clears', async () => {
		const f = await setUp();
		const start = centreOf(f.tabs[0]);
		expect(f.drag.offset, 'got an offset at rest').toBeUndefined();
		await realMouse.press(start);
		await realMouse.move(start, shifted(start, FOLLOW_PX));
		const following = f.drag.offset;
		await realMouse.release(shifted(start, FOLLOW_PX));
		expect(following, `got offset ${following}, want ~${FOLLOW_PX}`).toBeGreaterThan(
			FOLLOW_PX - OFFSET_TOLERANCE_PX
		);
		expect(following).toBeLessThan(FOLLOW_PX + OFFSET_TOLERANCE_PX);
		expect(f.drag.offset, 'got an offset after release').toBeUndefined();
	});

	it('pointercancel mid-drag clears the offset and chooses nothing', async () => {
		const f = await setUp();
		const start = centreOf(f.tabs[0]);
		await realMouse.press(start);
		await realMouse.move(start, centreOf(f.tabs[1]));
		expect(f.drag.offset, 'want a drag in progress').toBeDefined();
		f.track.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		expect(f.drag.offset, 'got an offset after pointercancel').toBeUndefined();
		await realMouse.release(centreOf(f.tabs[1]));
		expect(f.choose, 'got choose after a cancelled drag').not.toHaveBeenCalled();
		expect(f.drag.restingIndex(0), 'want the thumb back on the selection').toBe(0);
	});
});

describe("ThumbDrag: the drag's own click", () => {
	it('swallows the trusted click (detail 1) a mouse drag ends with', async () => {
		const f = await setUp();
		await mouseDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		expect(f.clicksThrough, "got the drag's click through to a tab").toEqual([]);
	});

	it('lets a keyboard click (trusted, detail 0) through after a drag', async () => {
		const f = await setUp();
		await touchDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		await afterGesture();
		f.tabs[1].focus();
		await userEvent.keyboard('{Enter}');
		expect(f.clicksThrough, 'want the Enter click on Popular').toEqual([1]);
	});

	it('lets the next tap through after a drag', async () => {
		const f = await setUp();
		await mouseDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		await afterGesture();
		await mouseDrag(centreOf(f.tabs[1]));
		expect(f.clicksThrough, 'want the later tap on Popular').toEqual([1]);
	});

	// Review bug A: a long touch drag fires no click, so nothing consumes the
	// swallow; it must end with the gesture, not wait for the next click.
	it('does not swallow a later trusted click (detail 1) after a drag that fired no click', async () => {
		const f = await setUp();
		await touchDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		await disableTouch();
		await afterGesture();
		await clickWithoutTrackPress(f.tabs[1]);
		expect(f.clicksThrough, 'got a later click swallowed by an old drag').toEqual([1]);
	});
});

describe('ThumbDrag: the held segment', () => {
	it('restingIndex holds the chosen segment until the selection catches up', async () => {
		const f = await setUp();
		await mouseDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
		expect(f.drag.restingIndex(0), 'want the thumb held on Popular').toBe(1);
		f.drag.forgetHeld(0);
		expect(f.drag.restingIndex(0), 'got the hold dropped before the selection moved').toBe(1);
		f.select(1);
		f.drag.forgetHeld(1);
		expect(f.drag.restingIndex(1)).toBe(1);
		expect(f.drag.restingIndex(0), 'got a stale hold after the selection caught up').toBe(0);
	});

	it('restingIndex is the selection when nothing was dragged', async () => {
		const f = await setUp();
		expect([f.drag.restingIndex(0), f.drag.restingIndex(1)]).toEqual([0, 1]);
	});

	// Review bug B: while the drag-select is pending, another pointer going
	// down must not drop the hold (the thumb would jump back).
	const otherPresses: { name: string; init: PointerEventInit }[] = [
		{
			name: 'a second finger (isPrimary false)',
			init: { pointerId: 42, pointerType: 'touch', isPrimary: false, button: 0 }
		},
		{
			name: 'a right-button press (button 2)',
			init: { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 2, buttons: 2 }
		}
	];
	for (const { name, init } of otherPresses) {
		it(`keeps the hold when ${name} goes down while the selection is pending`, async () => {
			const f = await setUp();
			await touchDrag(centreOf(f.tabs[0]), centreOf(f.tabs[1]));
			await afterGesture();
			syntheticPress(f.tabs[0], init);
			expect(f.drag.restingIndex(0), `got the thumb sent back by ${name}`).toBe(1);
			expect(f.choose.mock.calls, 'want the one drag-select only').toEqual([[1]]);
		});
	}
});
