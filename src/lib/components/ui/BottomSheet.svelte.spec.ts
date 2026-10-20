import type { Snippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	CONTENT_TEST_ID,
	DEEP_CONTENT_HTML,
	TALL_CONTENT_HTML,
	appendButton,
	contentRoot,
	scrollTopsUpTo,
	scrollerOf,
	transitionRunning,
	belowRest,
	content,
	focusIsIn,
	labelled,
	landsOn,
	scrimBeside,
	screenFrame,
	settle
} from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	hitArea,
	loadUi,
	paintedBox,
	resetEmulatedMedia,
	style,
	transitionDuration,
	transitionTimingFunction,
	useViewport
} from '../../../testutil/ui';

// FE-3 BottomSheet: the mobile container for the region and dish sheets
// (mobile README -> Regional tab -> Region sheet; Popular tab -> Dish detail
// sheet: "Same sheet shell and states as the region sheet"):
// - "Bottom sheet, absolutely positioned, height 640px, bg `--bg-surface`, top
//   radius 26px, shadow `--shadow-sheet`." (26px is --radius-sheet.)
// - "States: hidden (translateY 680px), peek (translateY 640 − 310 = 330px),
//   expanded (translateY 0). Transition transform 450ms `--ease`."
// - "Tapping the handle area toggles peek ↔ expanded. Tapping the scrim →
//   hidden".
// - "Scrim behind the sheet: `--scrim`, opacity 0.18 at peek, 0.45 expanded,
//   400ms. Clickable only when the sheet is visible."
// - "Handle area (padding 10px 0 6px, clickable): 40×4px bar, radius 2px,
//   `--border-chip`. No text label."
// - Accessibility: "Sheets: focus-trap when expanded, Escape closes. Respect
//   `prefers-reduced-motion` (swap slides for fades)"; "All tap targets ≥ 44px".
// Stage FE-3: "focus returns to the element that opened it", "`aria-modal`
// when expanded", "the drag behaviour of 3a is not built".
// D-FE3-1: geometry is --sheet-height (min(76dvh, 640px)), --sheet-offset-peek
// and --sheet-offset-hidden (layout.css); exactly 640 / 330 / 680 at 390×844.
//
// The sheet is controlled: it reports a wanted state through onStateChange
// and shows whatever `state` it is given. `label` (the region or dish name)
// is its accessible name, as aria-label; `handleLabel` names the handle
// button, which has no visible text. Both are messages chosen by the caller.

type SheetState = 'hidden' | 'peek' | 'expanded';
type BottomSheetProps = {
	state: SheetState;
	onStateChange: (next: SheetState) => void;
	label: string;
	handleLabel: string;
	children: Snippet;
};

const LABEL = 'Galicia';
const HANDLE_LABEL = 'Expand';
const SHEET_DURATION = '0.45s';
// Halfway through the 450ms sheet fade (README "450ms"), for mid-fade reads.
const MID_FADE_MS = (parseFloat(SHEET_DURATION) * 1000) / 2;
const SCRIM_DURATION = '0.4s';
const HIT_MIN_PX = 44;
// A point well above the sheet in every state at 390×844 (expanded top: 204).
const ABOVE_SHEET = { x: 195, y: 100 };

async function renderSheet(state: SheetState, html?: string) {
	const BottomSheet = await loadUi<BottomSheetProps>('BottomSheet');
	const frame = screenFrame();
	const opener = appendButton(frame, 'Opener');
	const onStateChange = vi.fn<(next: SheetState) => void>();
	const props = { state, onStateChange, label: LABEL, handleLabel: HANDLE_LABEL };
	const result = await render(BottomSheet, {
		target: frame,
		props: { ...props, children: content(html) }
	});
	const after = appendButton(frame, 'After');
	const sheet = labelled(frame, LABEL);
	settle();
	// Changes state and leaves any transition running (read mid-transition).
	const startState = (next: SheetState) => result.rerender({ state: next });
	const setState = async (next: SheetState) => {
		await startState(next);
		settle();
	};
	return { frame, opener, after, sheet, onStateChange, setState, startState };
}

function handleOf(sheet: HTMLElement): HTMLElement {
	return labelled(sheet, HANDLE_LABEL);
}

function contentButton(sheet: HTMLElement, name: 'First' | 'Last'): HTMLElement {
	const buttons = sheet.querySelectorAll<HTMLElement>(`[data-testid="${CONTENT_TEST_ID}"] button`);
	return name === 'First' ? buttons[0] : buttons[buttons.length - 1];
}

describe('BottomSheet geometry (D-FE3-1)', () => {
	const frames = [
		// The design frame: README "height 640px", "680px", "330px".
		{ width: 390, height: 844, sheet: 640, peek: 330, hidden: 680 },
		// Taller phone: the sheet stays capped at 640px.
		{ width: 430, height: 932, sheet: 640, peek: 330, hidden: 680 },
		// Shorter phone: 76dvh = 486.4px; the 310px peek stays fixed.
		{ width: 360, height: 640, sheet: 486.4, peek: 176.4, hidden: 526.4 }
	];
	for (const f of frames) {
		describe(`at ${f.width}×${f.height}`, () => {
			useViewport(f.width, f.height);

			it(`is ${f.sheet}px tall`, async () => {
				const { sheet } = await renderSheet('peek');
				expect(sheet.getBoundingClientRect().height).toBeCloseTo(f.sheet, 0);
			});

			const states = [
				{ state: 'expanded', offset: 0 },
				{ state: 'peek', offset: f.peek },
				{ state: 'hidden', offset: f.hidden }
			] as const;
			for (const { state, offset } of states) {
				it(`sits ${offset}px below its resting place when ${state}`, async () => {
					const { sheet, frame } = await renderSheet(state);
					expect(belowRest(sheet, frame)).toBeCloseTo(offset, 0);
				});
			}

			it('spans the full width', async () => {
				const { sheet } = await renderSheet('expanded');
				const { left, width } = sheet.getBoundingClientRect();
				expect({ left, width }).toEqual({ left: 0, width: f.width });
			});
		});
	}
});

describe('BottomSheet surface', () => {
	useViewport(390, 844);

	it('is filled with --bg-surface', async () => {
		const { sheet } = await renderSheet('expanded');
		const want = computed('background-color', 'var(--bg-surface)');
		expect(style(sheet, 'background-color')).toBe(want);
	});

	it('rounds its top corners by --radius-sheet (26px) and not its bottom', async () => {
		const { sheet } = await renderSheet('expanded');
		const want = computed('border-top-left-radius', 'var(--radius-sheet)');
		expect(want).toBe('26px');
		expect(style(sheet, 'border-top-left-radius')).toBe(want);
		expect(style(sheet, 'border-top-right-radius')).toBe(want);
		expect(style(sheet, 'border-bottom-left-radius')).toBe('0px');
		expect(style(sheet, 'border-bottom-right-radius')).toBe('0px');
	});

	it('casts --shadow-sheet', async () => {
		const { sheet } = await renderSheet('expanded');
		expect(style(sheet, 'box-shadow')).toBe(computed('box-shadow', 'var(--shadow-sheet)'));
	});

	it(`moves with a ${SHEET_DURATION} --ease transform transition`, async () => {
		const { sheet } = await renderSheet('peek');
		expect(transitionDuration(sheet, 'transform')).toBe(SHEET_DURATION);
		const ease = computed('transition-timing-function', 'var(--ease)');
		expect(transitionTimingFunction(sheet, 'transform')).toBe(ease);
	});

	it('renders its children', async () => {
		const { sheet } = await renderSheet('peek');
		const inside = sheet.querySelectorAll(`[data-testid="${CONTENT_TEST_ID}"]`);
		expect(inside.length, 'want the content once, inside the sheet').toBe(1);
	});
});

describe('BottomSheet handle', () => {
	useViewport(390, 844);

	it('is a type="button" <button> named by handleLabel, with no visible text', async () => {
		const handle = handleOf((await renderSheet('peek')).sheet);
		expect(handle.tagName).toBe('BUTTON');
		expect(handle.getAttribute('type')).toBe('button');
		expect(handle.textContent?.trim(), 'got visible text, want none').toBe('');
	});

	const expandedStates = [
		{ state: 'peek', expanded: 'false' },
		{ state: 'expanded', expanded: 'true' }
	] as const;
	for (const { state, expanded } of expandedStates) {
		it(`has aria-expanded="${expanded}" when ${state}`, async () => {
			const handle = handleOf((await renderSheet(state)).sheet);
			expect(handle.getAttribute('aria-expanded')).toBe(expanded);
		});
	}

	it('has padding 10px 0 6px', async () => {
		const handle = handleOf((await renderSheet('peek')).sheet);
		const padding = ['top', 'right', 'bottom', 'left'].map((s) => style(handle, `padding-${s}`));
		expect(padding).toEqual(['10px', '0px', '6px', '0px']);
	});

	it('draws a 40×4px --border-chip bar with radius 2px', async () => {
		const bar = paintedBox(handleOf((await renderSheet('peek')).sheet));
		const { width, height } = bar.getBoundingClientRect();
		expect({ width, height }).toEqual({ width: 40, height: 4 });
		expect(style(bar, 'border-top-left-radius')).toBe('2px');
		const want = computed('background-color', 'var(--border-chip)');
		expect(style(bar, 'background-color')).toBe(want);
	});

	it(`answers pointer hits at least ${HIT_MIN_PX}px tall`, async () => {
		const area = hitArea(handleOf((await renderSheet('peek')).sheet));
		expect(area.height, `got hit height ${area.height}`).toBeGreaterThanOrEqual(HIT_MIN_PX);
	});

	const toggles = [
		{ from: 'peek', to: 'expanded' },
		{ from: 'expanded', to: 'peek' }
	] as const;
	for (const { from, to } of toggles) {
		it(`asks for ${to} when tapped while ${from}`, async () => {
			const { sheet, onStateChange } = await renderSheet(from);
			await userEvent.click(handleOf(sheet));
			expect(onStateChange.mock.calls).toEqual([[to]]);
		});
	}

	it('asks for expanded on Enter while peek (keyboard-operable)', async () => {
		const { sheet, onStateChange } = await renderSheet('peek');
		handleOf(sheet).focus();
		await userEvent.keyboard('{Enter}');
		expect(onStateChange.mock.calls).toEqual([['expanded']]);
	});
});

describe('BottomSheet scrim', () => {
	useViewport(390, 844);

	const levels = [
		{ state: 'peek', opacity: 0.18 },
		{ state: 'expanded', opacity: 0.45 }
	] as const;
	for (const { state, opacity } of levels) {
		it(`dims the page with --scrim at ${opacity} when ${state}`, async () => {
			const { frame, sheet } = await renderSheet(state);
			const scrim = scrimBeside(frame, sheet);
			expect(landsOn(scrim, ABOVE_SHEET.x, ABOVE_SHEET.y), 'want taps on the scrim').toBe(true);
			expect(parseFloat(style(scrim, 'opacity'))).toBeCloseTo(opacity, 5);
			const want = computed('background-color', 'var(--scrim)');
			expect(style(scrim, 'background-color')).toBe(want);
			expect(transitionDuration(scrim, 'opacity')).toBe(SCRIM_DURATION);
		});

		it(`asks for hidden when the scrim is tapped while ${state}`, async () => {
			const { frame, sheet, onStateChange } = await renderSheet(state);
			const scrim = scrimBeside(frame, sheet);
			await userEvent.click(scrim, { position: ABOVE_SHEET });
			expect(onStateChange.mock.calls).toEqual([['hidden']]);
		});
	}

	it('is transparent and lets taps through when hidden', async () => {
		const { frame, sheet } = await renderSheet('hidden');
		const scrim = scrimBeside(frame, sheet);
		expect(parseFloat(style(scrim, 'opacity'))).toBe(0);
		expect(landsOn(scrim, ABOVE_SHEET.x, ABOVE_SHEET.y), 'got a tap on the hidden scrim').toBe(
			false
		);
	});

	it('sits behind the sheet: a tap on the sheet lands on the sheet', async () => {
		const { sheet } = await renderSheet('expanded');
		const { left, top, width } = sheet.getBoundingClientRect();
		expect(landsOn(sheet, left + width / 2, top + 100), 'want the sheet on top').toBe(true);
	});
});

describe('BottomSheet when expanded (modal)', () => {
	useViewport(390, 844);

	it('is a modal dialog named by its label', async () => {
		await renderSheet('expanded');
		const dialog = page.getByRole('dialog', { name: LABEL, exact: true });
		await expect.element(dialog).toBeInTheDocument();
		expect(dialog.element().getAttribute('aria-modal')).toBe('true');
	});

	it('moves focus into the sheet when it expands', async () => {
		const { opener, sheet, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('expanded');
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
	});

	it('traps Tab: from the last control focus wraps to the first', async () => {
		const { sheet } = await renderSheet('expanded');
		contentButton(sheet, 'Last').focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to wrap to the handle').toBe(handleOf(sheet));
	});

	it('traps Shift+Tab: from the first control focus wraps to the last', async () => {
		const { sheet } = await renderSheet('expanded');
		handleOf(sheet).focus();
		await userEvent.tab({ shift: true });
		expect(document.activeElement, 'want Shift+Tab to wrap to the last control').toBe(
			contentButton(sheet, 'Last')
		);
	});

	it('asks for hidden on Escape', async () => {
		const { sheet, onStateChange } = await renderSheet('expanded');
		contentButton(sheet, 'First').focus();
		await userEvent.keyboard('{Escape}');
		expect(onStateChange.mock.calls).toEqual([['hidden']]);
	});

	it('returns focus to the opener once hidden after Escape', async () => {
		const { opener, sheet, onStateChange, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('expanded');
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		await userEvent.keyboard('{Escape}');
		expect(onStateChange.mock.calls).toEqual([['hidden']]);
		await setState('hidden');
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});

	// The opener is what had focus before the sheet left hidden (a map region),
	// not the handle that expanded it.
	it('returns focus to the opener, not the handle, after peek → expanded → hidden', async () => {
		const { opener, sheet, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('peek');
		await userEvent.click(handleOf(sheet));
		await setState('expanded');
		await userEvent.keyboard('{Escape}');
		await setState('hidden');
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});

	// QA S4, with real pointer clicks: a page button opens the sheet at peek,
	// a click on the handle expands it, Escape closes it.
	it('returns focus to the clicked page button after click → peek, handle click → expanded, Escape', async () => {
		const { opener, sheet, setState } = await renderSheet('hidden');
		await userEvent.click(opener);
		await setState('peek');
		await userEvent.click(handleOf(sheet));
		await setState('expanded');
		await userEvent.keyboard('{Escape}');
		await setState('hidden');
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});

	// QA S4 as the gallery (and a /regions/:key deep link) has it: the sheet is
	// already at peek when the page loads, so nothing "opened" it; the user
	// clicks a page button, then the handle. Escape must return focus to that
	// button (the last control outside the sheet before focus went in), not
	// to <body>, which had focus when the sheet first showed.
	it('returns focus to the last page control, not <body>, when the sheet was at peek from the start', async () => {
		const { opener, sheet, setState } = await renderSheet('peek');
		// In the gallery the page buttons sit outside the sheet's frame, so a
		// click focuses them; here the frame's peek scrim covers the stand-in
		// opener, so it is focused the way that click would.
		opener.focus();
		await userEvent.click(handleOf(sheet));
		await setState('expanded');
		await userEvent.keyboard('{Escape}');
		await setState('hidden');
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});
});

describe('BottomSheet when peek (not modal)', () => {
	useViewport(390, 844);

	it('is not aria-modal', async () => {
		const { frame } = await renderSheet('peek');
		expect(frame.querySelector('[aria-modal="true"]'), 'got an aria-modal element').toBeNull();
	});

	it('does not take focus when it appears', async () => {
		const { opener, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('peek');
		expect(document.activeElement, 'want focus to stay on the opener').toBe(opener);
	});

	it('lets Tab leave the sheet for the page', async () => {
		const { sheet, after } = await renderSheet('peek');
		contentButton(sheet, 'Last').focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to reach the page after the sheet').toBe(after);
	});

	// Accessibility: "Escape closes" applies to the sheet, not only expanded.
	it('asks for hidden on Escape while focus is inside', async () => {
		const { sheet, onStateChange } = await renderSheet('peek');
		contentButton(sheet, 'First').focus();
		await userEvent.keyboard('{Escape}');
		expect(onStateChange.mock.calls).toEqual([['hidden']]);
	});
});

describe('BottomSheet when hidden', () => {
	useViewport(390, 844);

	it('is out of the tab order', async () => {
		const { opener, after } = await renderSheet('hidden');
		opener.focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to skip the hidden sheet').toBe(after);
	});

	it('cannot be focused into', async () => {
		const { sheet, opener } = await renderSheet('hidden');
		opener.focus();
		contentButton(sheet, 'First').focus();
		expect(document.activeElement, 'got focus inside the hidden sheet').toBe(opener);
	});

	// inert takes it out of the tab order and the accessibility tree alike.
	it('is inert', async () => {
		const { sheet } = await renderSheet('hidden');
		expect(
			sheet.closest('[inert]'),
			'want the hidden sheet inside an inert subtree'
		).not.toBeNull();
	});

	it('is not inert once shown', async () => {
		const { sheet, setState } = await renderSheet('hidden');
		await setState('peek');
		expect(sheet.closest('[inert]'), 'got a shown sheet that is inert').toBeNull();
	});
});

describe('BottomSheet under prefers-reduced-motion: reduce', () => {
	useViewport(390, 844);
	afterEach(resetEmulatedMedia);

	it('does not animate its transform', async () => {
		await emulateReducedMotion('reduce');
		const { sheet } = await renderSheet('peek');
		expect(animates(sheet, 'transform'), 'got a transform transition').toBe(false);
	});

	it(`fades its opacity over ${SHEET_DURATION} instead`, async () => {
		await emulateReducedMotion('reduce');
		const { sheet } = await renderSheet('peek');
		expect(transitionDuration(sheet, 'opacity')).toBe(SHEET_DURATION);
	});

	it('is fully transparent when hidden and opaque when shown', async () => {
		await emulateReducedMotion('reduce');
		const { sheet, setState } = await renderSheet('peek');
		expect(style(sheet, 'opacity')).toBe('1');
		await setState('hidden');
		expect(style(sheet, 'opacity')).toBe('0');
	});
});

// Review / QA findings (FE-3 PR 2). Focusing a control below the fold must
// not scroll the sheet's layer (an overflow: hidden box still scrolls to
// show the focused element), which would lift the peek sheet and leave it
// partly on screen once hidden.
describe('BottomSheet focus deep in a peek sheet', () => {
	useViewport(390, 844);

	function deepButton(sheet: HTMLElement): HTMLElement {
		return contentRoot(sheet).querySelector('button')!;
	}

	it('scrolls nothing from the sheet up to the screen and stays at peek (330px)', async () => {
		const { frame, sheet } = await renderSheet('peek', DEEP_CONTENT_HTML);
		deepButton(sheet).focus();
		settle();
		const tops = scrollTopsUpTo(sheet, frame);
		expect(tops, 'got a scrolled sheet, layer or frame').toEqual(tops.map(() => 0));
		expect(belowRest(sheet, frame)).toBeCloseTo(330, 0);
	});

	// Expanding moves focus in while the sheet still sits off screen.
	it('scrolls nothing when it expands from hidden and focus moves in', async () => {
		const { frame, opener, sheet, startState } = await renderSheet('hidden');
		opener.focus();
		await startState('expanded');
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		const tops = scrollTopsUpTo(sheet, frame);
		expect(tops, 'got a scrolled sheet, layer or frame').toEqual(tops.map(() => 0));
		settle();
		expect(belowRest(sheet, frame)).toBeCloseTo(0, 0);
	});

	it('is fully off screen (680px) once hidden after that', async () => {
		const { frame, sheet, setState } = await renderSheet('peek', DEEP_CONTENT_HTML);
		deepButton(sheet).focus();
		settle();
		await setState('hidden');
		expect(belowRest(sheet, frame)).toBeCloseTo(680, 0);
	});
});

// The sheet owns its overflow: content taller than it scrolls in a body
// below the handle, the sheet keeps its height and the handle stays put.
const OVERFLOW_FRAMES = [
	{ width: 390, height: 844, sheet: 640 },
	// Landscape phone: 76dvh of 390 = 296.4px.
	{ width: 844, height: 390, sheet: 296.4 }
];
for (const f of OVERFLOW_FRAMES) {
	describe(`BottomSheet with content taller than itself at ${f.width}×${f.height}`, () => {
		useViewport(f.width, f.height);

		async function renderTall() {
			const rendered = await renderSheet('expanded', TALL_CONTENT_HTML);
			const scroller = scrollerOf(contentRoot(rendered.sheet), rendered.sheet);
			return { ...rendered, scroller, handle: handleOf(rendered.sheet) };
		}

		it(`keeps its ${f.sheet}px height`, async () => {
			const { sheet } = await renderTall();
			expect(sheet.getBoundingClientRect().height).toBeCloseTo(f.sheet, 0);
		});

		it('scrolls the content in a body below the handle, inside the sheet', async () => {
			const { sheet, scroller, handle } = await renderTall();
			expect(scroller.contains(handle), 'got the handle scrolling with the content').toBe(false);
			const body = scroller.getBoundingClientRect();
			expect(body.top).toBeGreaterThanOrEqual(handle.getBoundingClientRect().bottom - 0.5);
			expect(body.bottom).toBeLessThanOrEqual(sheet.getBoundingClientRect().bottom + 0.5);
			expect(scroller.scrollHeight, 'want the body to overflow').toBeGreaterThan(
				scroller.clientHeight
			);
			expect(style(scroller, 'overscroll-behavior-y')).toBe('contain');
		});

		it('keeps the handle in place and shows the last control when scrolled to the end', async () => {
			const { sheet, scroller, handle } = await renderTall();
			const handleTop = handle.getBoundingClientRect().top;
			scroller.scrollTop = scroller.scrollHeight;
			const last = contentButton(sheet, 'Last').getBoundingClientRect();
			expect(handle.getBoundingClientRect().top).toBe(handleTop);
			expect(sheet.scrollTop, 'got the sheet itself scrolling').toBe(0);
			expect(last.bottom).toBeLessThanOrEqual(sheet.getBoundingClientRect().bottom + 0.5);
		});
	});
}

// Escape closes a shown sheet wherever focus is (peek has no trap, and focus
// may sit on the opener or on a page control an overlay returned it to). A
// handled Escape is marked with preventDefault, and one already handled
// (by an overlay above, or anything else) is left alone.
describe('BottomSheet and Escape', () => {
	useViewport(390, 844);

	function pressEscapeOn(el: HTMLElement): KeyboardEvent {
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		el.dispatchEvent(event);
		return event;
	}

	it('asks for hidden at peek while focus is on the opener (outside the sheet)', async () => {
		const { opener, onStateChange, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('peek');
		await userEvent.keyboard('{Escape}');
		expect(onStateChange.mock.calls).toEqual([['hidden']]);
	});

	it('asks for hidden when expanded while focus is on a page control', async () => {
		const { after, onStateChange } = await renderSheet('expanded');
		after.focus();
		await userEvent.keyboard('{Escape}');
		expect(onStateChange.mock.calls).toEqual([['hidden']]);
	});

	it('ignores Escape while hidden', async () => {
		const { opener, onStateChange } = await renderSheet('hidden');
		opener.focus();
		await userEvent.keyboard('{Escape}');
		expect(onStateChange, 'got a hidden sheet reacting to Escape').not.toHaveBeenCalled();
	});

	it('calls preventDefault on the Escape it handles', async () => {
		const { opener } = await renderSheet('peek');
		opener.focus();
		const event = pressEscapeOn(opener);
		expect(event.defaultPrevented, 'want the handled Escape marked').toBe(true);
	});

	it('ignores an Escape already defaultPrevented', async () => {
		const { sheet, onStateChange } = await renderSheet('peek');
		const control = contentButton(sheet, 'First');
		control.addEventListener('keydown', (event) => event.preventDefault());
		control.focus();
		await userEvent.keyboard('{Escape}');
		expect(onStateChange, 'got the sheet acting on a handled Escape').not.toHaveBeenCalled();
	});
});

// Focus goes back to the opener only if it is still in the sheet (or lost,
// on <body>): a user who has moved on keeps their place.
describe('BottomSheet focus return when focus has moved on', () => {
	useViewport(390, 844);

	it('leaves focus on the page control Tab reached from a peek sheet', async () => {
		const { opener, after, sheet, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('peek');
		contentButton(sheet, 'Last').focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to reach the page control').toBe(after);
		await setState('hidden');
		expect(document.activeElement, 'want focus to stay on the page control').toBe(after);
	});

	it('returns focus to the opener after a scrim tap left it on <body>', async () => {
		const { frame, opener, sheet, setState } = await renderSheet('hidden');
		opener.focus();
		await setState('expanded');
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		await userEvent.click(scrimBeside(frame, sheet), { position: ABOVE_SHEET });
		await setState('hidden');
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});
});

// Reduced motion: the slide becomes a fade, so a closing sheet must fade out
// where it rests; jumping off screen first would make the fade invisible.
describe('BottomSheet closing under prefers-reduced-motion: reduce', () => {
	useViewport(390, 844);
	afterEach(resetEmulatedMedia);

	const rests = [
		{ from: 'peek', offset: 330 },
		{ from: 'expanded', offset: 0 }
	] as const;
	for (const { from, offset } of rests) {
		it(`fades out at its ${from} position (${offset}px) without moving`, async () => {
			await emulateReducedMotion('reduce');
			const { frame, sheet, startState } = await renderSheet(from);
			await startState('hidden');
			expect(transitionRunning(sheet, 'opacity'), 'want an opacity fade').toBe(true);
			expect(transitionRunning(sheet, 'transform'), 'got a transform transition').toBe(false);
			expect(belowRest(sheet, frame)).toBeCloseTo(offset, 0);
			for (const animation of sheet.getAnimations()) animation.currentTime = MID_FADE_MS;
			expect(belowRest(sheet, frame), 'got the sheet moving mid-fade').toBeCloseTo(offset, 0);
		});

		it(`ends transparent and inert after fading out from ${from}`, async () => {
			await emulateReducedMotion('reduce');
			const { sheet, startState } = await renderSheet(from);
			await startState('hidden');
			settle();
			await expect.poll(() => style(sheet, 'opacity'), { timeout: 1000 }).toBe('0');
			await expect.poll(() => sheet.closest('[inert]') !== null, { timeout: 1000 }).toBe(true);
		});
	}
});
