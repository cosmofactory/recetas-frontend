import { afterEach, describe, expect, it } from 'vitest';
import { loadUiExport, stage } from '../../testutil/ui';
import {
	centreOf,
	disableTouch,
	realMouse,
	realTouch,
	type Point
} from '../../testutil/real-input';

// FE-9 FB-2 / FB-3: PointerPress (src/lib/ui/pointer-press.ts) cancels the
// click of a press that slides off the pressed control without dragging
// (as a press does without pointer capture). "The pressed control" is the
// activatable one (a link, a button, a tab), not the deepest element under
// the press: a tap that lands on a control's child (a row's name, the
// handle's bar) and lifts a few px later on another part of the same
// control (its description, its padding) is still a tap on that control.
// Bug: the slide-off check used the press's event.target (the child), so
// such a tap lost its click.
//
// The fixture wires a PointerPress to a container the way the sheet and the
// switch do (press on pointerdown, release on pointerup, the capture-phase
// click guard) and drives it with real input (CDP), so clicks are trusted.

type PointerPressLike = {
	pressed: boolean;
	begin: (event: PointerEvent) => void;
	travel: (event: PointerEvent) => number | undefined;
	release: (event: PointerEvent) => number | undefined;
	cancel: (event: PointerEvent) => boolean;
	clickAfterDrag: (event: MouseEvent) => void;
};
type PointerPressClass = new (axis: 'x' | 'y') => PointerPressLike;
type IsPrimaryPress = (event: PointerEvent) => boolean;

const MODULE = 'pointer-press.ts';
// Under the 4px slop: a tap's finger jitter.
const JITTER_PX = 3;
// Sideways off the control (the press's axis is y, so never a drag).
const SLIDE_OFF_PX = 150;
const CONTROL_WIDTH_PX = 200;
const PART_HEIGHT_PX = 20;
const CONTROL_PADDING_PX = 10;

const CONTROLS = [
	{ kind: 'a[href]', html: (inner: string) => `<a href="#row">${inner}</a>` },
	{ kind: 'button', html: (inner: string) => `<button type="button">${inner}</button>` },
	{ kind: '[role=tab]', html: (inner: string) => `<div role="tab" tabindex="0">${inner}</div>` }
] as const;

type Fixture = {
	control: HTMLElement;
	first: HTMLElement;
	second: HTMLElement;
	// Clicks that reached the control, each with whether it was prevented.
	clicks: boolean[];
};

const PARTS_HTML =
	`<span class="first" style="display: block; height: ${PART_HEIGHT_PX}px">Tortilla</span>` +
	`<span class="second" style="display: block; height: ${PART_HEIGHT_PX}px">Betanzos</span>`;

const CONTROL_STYLE =
	`display: block; width: ${CONTROL_WIDTH_PX}px; padding: ${CONTROL_PADDING_PX}px 0; ` +
	'margin: 0; border: 0; font: inherit; text-align: left';

function wire(root: HTMLElement, press: PointerPressLike, isPrimaryPress: IsPrimaryPress) {
	root.addEventListener('pointerdown', (event) => {
		if (isPrimaryPress(event)) press.begin(event);
	});
	root.addEventListener('pointermove', (event) => press.travel(event));
	root.addEventListener('pointerup', (event) => press.release(event));
	root.addEventListener('pointercancel', (event) => press.cancel(event));
	root.addEventListener('click', press.clickAfterDrag, { capture: true });
}

function recordClicks(control: HTMLElement): boolean[] {
	const clicks: boolean[] = [];
	control.addEventListener('click', (event) => {
		clicks.push(event.defaultPrevented);
		event.preventDefault();
	});
	return clicks;
}

async function setUp(html: (inner: string) => string): Promise<Fixture> {
	const PointerPress = await loadUiExport<PointerPressClass>(MODULE, 'PointerPress');
	const isPrimaryPress = await loadUiExport<IsPrimaryPress>(MODULE, 'isPrimaryPress');
	const root = stage('padding: 40px; width: 400px; touch-action: none; user-select: none');
	root.innerHTML = html(PARTS_HTML);
	const control = root.firstElementChild as HTMLElement;
	control.setAttribute('style', CONTROL_STYLE);
	wire(root, new PointerPress('y'), isPrimaryPress);
	const first = control.querySelector<HTMLElement>('.first')!;
	const second = control.querySelector<HTMLElement>('.second')!;
	return { control, first, second, clicks: recordClicks(control) };
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function afterGesture() {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	await nextFrame();
}

// Just above the bottom edge of `el`, so a JITTER_PX move leaves it.
function nearBottomOf(el: Element): Point {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.bottom - 1 };
}

const below = (point: Point, dy: number): Point => ({ x: point.x, y: point.y + dy });

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

function expectOneClickKept(f: Fixture, what: string) {
	expect(f.clicks, `${what}: got clicks ${JSON.stringify(f.clicks)}, want [false]`).toEqual([
		false
	]);
}

afterEach(() => disableTouch());

describe('PointerPress: a tap that moves within the pressed control keeps its click', () => {
	for (const { kind, html } of CONTROLS) {
		it(`${kind}: control, press and release on the same child`, async () => {
			const f = await setUp(html);
			const at = centreOf(f.first);
			await mouseTap(at, at);
			expectOneClickKept(f, 'tap on one child');
		});

		it(`${kind}: press on one child, release ${JITTER_PX}px away on its sibling`, async () => {
			const f = await setUp(html);
			const from = nearBottomOf(f.first);
			const to = below(from, JITTER_PX);
			expectUnder(f.second, to, 'want the release on the sibling');
			await mouseTap(from, to);
			expectOneClickKept(f, 'release on a sibling inside the control');
		});

		it(`${kind}: press on a child, release ${JITTER_PX}px away on the control's padding`, async () => {
			const f = await setUp(html);
			const from = nearBottomOf(f.second);
			const to = below(from, JITTER_PX);
			expectUnder(f.control, to, "want the release on the control's own padding");
			await mouseTap(from, to);
			expectOneClickKept(f, "release on the control's padding");
		});

		it(`${kind}: a finger tap that moves onto the sibling keeps its click`, async () => {
			const f = await setUp(html);
			const from = nearBottomOf(f.first);
			const to = below(from, JITTER_PX);
			await realTouch.start(from);
			await realTouch.move(from, to);
			await realTouch.end();
			await afterGesture();
			expectOneClickKept(f, 'finger tap moved onto the sibling');
		});
	}
});

describe('PointerPress: a press released off the pressed control is swallowed', () => {
	for (const { kind, html } of CONTROLS) {
		it(`${kind}: press on a child, slide off sideways, release outside`, async () => {
			const f = await setUp(html);
			const from = centreOf(f.first);
			const away = { x: from.x + SLIDE_OFF_PX, y: from.y };
			const under = document.elementFromPoint(away.x, away.y);
			expect(f.control.contains(under), 'want the release outside the control').toBe(false);
			await mouseTap(from, away);
			expect(f.clicks, `got clicks ${JSON.stringify(f.clicks)} after sliding off`).toEqual([]);
		});
	}
});
