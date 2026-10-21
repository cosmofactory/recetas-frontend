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
	paintingInFrame,
	scrimBeside,
	screenFrame,
	settle
} from '../../../testutil/sheet';
import {
	animates,
	computed,
	emulateReducedMotion,
	loadUi,
	resetEmulatedMedia,
	style,
	transitionDuration,
	transitionTimingFunction,
	useViewport
} from '../../../testutil/ui';

// FE-3 OverlaySheet: the Filters sheet's container. Mobile README -> Filters
// sheet: "Overlay above everything (z above home sheet). Bg `--bg-surface`,
// top radius 24px, shadow `--shadow-filter-sheet`, padding 12px 20px 22px,
// column gap 14px. Hidden: translateY(110%); open: 0; 400ms `--ease`. Scrim
// `--scrim-filter`, 300ms, tap closes." Stage FE-3: "`translateY(110%)` → 0
// over 400ms, above the home sheet". Accessibility: focus trap, Escape closes,
// slides become fades under reduced motion. 24px is not a design token; it
// belongs in layout.css (CLAUDE.md: app-level tokens go there).
//
// Controlled like BottomSheet: `open` shows it, `onClose` asks to close it
// (scrim tap, Escape); `label` is its accessible name (aria-label).

type OverlaySheetProps = {
	open: boolean;
	onClose: () => void;
	label: string;
	children: Snippet;
};
type BottomSheetProps = {
	state: 'hidden' | 'peek' | 'expanded';
	onStateChange: (next: string) => void;
	label: string;
	handleLabel: string;
	children: Snippet;
};

const LABEL = 'Filters';
const SHEET_DURATION = '0.4s';
// Halfway through the 400ms filters fade (README "400ms"), for mid-fade reads.
const MID_FADE_MS = (parseFloat(SHEET_DURATION) * 1000) / 2;
const SCRIM_DURATION = '0.3s';
// Well above the (short) filters sheet at 390×844.
const ABOVE_SHEET = { x: 195, y: 100 };

async function renderOverlay(open: boolean, frame = screenFrame(), html?: string) {
	const OverlaySheet = await loadUi<OverlaySheetProps>('OverlaySheet');
	const opener = appendButton(frame, 'Opener');
	const onClose = vi.fn();
	const result = await render(OverlaySheet, {
		target: frame,
		props: { open, onClose, label: LABEL, children: content(html) }
	});
	const after = appendButton(frame, 'After');
	const sheet = labelled(frame, LABEL);
	settle();
	// Opens or closes and leaves any transition running (read mid-transition).
	const startOpen = (next: boolean) => result.rerender({ open: next });
	const setOpen = async (next: boolean) => {
		await startOpen(next);
		settle();
	};
	return { frame, opener, after, sheet, onClose, setOpen, startOpen };
}

function contentButtons(sheet: HTMLElement): HTMLElement[] {
	const root = `[data-testid="${CONTENT_TEST_ID}"]`;
	return [...sheet.querySelectorAll<HTMLElement>(`${root} button, ${root} a[href]`)];
}

describe('OverlaySheet position', () => {
	useViewport(390, 844);

	it('rests on the bottom edge when open', async () => {
		const { sheet, frame } = await renderOverlay(true);
		expect(belowRest(sheet, frame)).toBeCloseTo(0, 0);
	});

	it('sits 110% of its own height below when closed', async () => {
		const { sheet, frame } = await renderOverlay(false);
		const { height } = sheet.getBoundingClientRect();
		expect(height, 'want a sheet with some height').toBeGreaterThan(0);
		expect(belowRest(sheet, frame)).toBeCloseTo(height * 1.1, 0);
	});

	it('spans the full width', async () => {
		const { sheet } = await renderOverlay(true);
		const { left, width } = sheet.getBoundingClientRect();
		expect({ left, width }).toEqual({ left: 0, width: 390 });
	});

	it(`moves with a ${SHEET_DURATION} --ease transform transition`, async () => {
		const { sheet } = await renderOverlay(true);
		expect(transitionDuration(sheet, 'transform')).toBe(SHEET_DURATION);
		const ease = computed('transition-timing-function', 'var(--ease)');
		expect(transitionTimingFunction(sheet, 'transform')).toBe(ease);
	});
});

describe('OverlaySheet surface', () => {
	useViewport(390, 844);

	it('is filled with --bg-surface', async () => {
		const { sheet } = await renderOverlay(true);
		const want = computed('background-color', 'var(--bg-surface)');
		expect(style(sheet, 'background-color')).toBe(want);
	});

	it('rounds its top corners by 24px and not its bottom', async () => {
		const { sheet } = await renderOverlay(true);
		expect(style(sheet, 'border-top-left-radius')).toBe('24px');
		expect(style(sheet, 'border-top-right-radius')).toBe('24px');
		expect(style(sheet, 'border-bottom-left-radius')).toBe('0px');
		expect(style(sheet, 'border-bottom-right-radius')).toBe('0px');
	});

	it('casts --shadow-filter-sheet', async () => {
		const { sheet } = await renderOverlay(true);
		const want = computed('box-shadow', 'var(--shadow-filter-sheet)');
		expect(style(sheet, 'box-shadow')).toBe(want);
	});

	it('has padding 12px 20px 22px', async () => {
		const { sheet } = await renderOverlay(true);
		const padding = ['top', 'right', 'bottom', 'left'].map((s) => style(sheet, `padding-${s}`));
		expect(padding).toEqual(['12px', '20px', '22px', '20px']);
	});

	it('renders its children', async () => {
		const { sheet } = await renderOverlay(true);
		const inside = sheet.querySelectorAll(`[data-testid="${CONTENT_TEST_ID}"]`);
		expect(inside.length, 'want the content once, inside the sheet').toBe(1);
	});
});

describe('OverlaySheet scrim', () => {
	useViewport(390, 844);

	it(`dims the page with --scrim-filter at full opacity over ${SCRIM_DURATION} when open`, async () => {
		const { frame, sheet } = await renderOverlay(true);
		const scrim = scrimBeside(frame, sheet);
		expect(landsOn(scrim, ABOVE_SHEET.x, ABOVE_SHEET.y), 'want taps on the scrim').toBe(true);
		expect(style(scrim, 'opacity')).toBe('1');
		const want = computed('background-color', 'var(--scrim-filter)');
		expect(style(scrim, 'background-color')).toBe(want);
		expect(transitionDuration(scrim, 'opacity')).toBe(SCRIM_DURATION);
	});

	it('asks to close when the scrim is tapped', async () => {
		const { frame, sheet, onClose } = await renderOverlay(true);
		await userEvent.click(scrimBeside(frame, sheet), { position: ABOVE_SHEET });
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
	});

	it('is transparent and lets taps through when closed', async () => {
		const { frame, sheet } = await renderOverlay(false);
		const scrim = scrimBeside(frame, sheet);
		expect(style(scrim, 'opacity')).toBe('0');
		expect(landsOn(scrim, ABOVE_SHEET.x, ABOVE_SHEET.y), 'got a tap on the hidden scrim').toBe(
			false
		);
	});
});

// "Overlay above everything (z above home sheet)": above an expanded
// BottomSheet and its scrim, even when rendered before it in the DOM.
describe('OverlaySheet stacking', () => {
	useViewport(390, 844);

	async function renderOverBottomSheet() {
		const frame = screenFrame();
		const overlay = await renderOverlay(true, frame);
		const filterScrim = scrimBeside(frame, overlay.sheet);
		const BottomSheet = await loadUi<BottomSheetProps>('BottomSheet');
		const onStateChange = vi.fn();
		await render(BottomSheet, {
			target: frame,
			props: {
				state: 'expanded',
				onStateChange,
				label: 'Galicia',
				handleLabel: 'Expand',
				children: content('<p>Region</p>')
			}
		});
		settle();
		return { ...overlay, filterScrim, homeSheet: labelled(frame, 'Galicia'), onStateChange };
	}

	it('draws the filters sheet above the home sheet', async () => {
		const { sheet } = await renderOverBottomSheet();
		const { left, top, width } = sheet.getBoundingClientRect();
		expect(landsOn(sheet, left + width / 2, top + 6), 'want the filters sheet on top').toBe(true);
	});

	it('draws its scrim above the home sheet, so a tap there closes the filters only', async () => {
		const { sheet, filterScrim, homeSheet, onClose, onStateChange } = await renderOverBottomSheet();
		const point = { x: 195, y: homeSheet.getBoundingClientRect().top + 40 };
		expect(landsOn(sheet, point.x, point.y), 'want a point above the filters sheet').toBe(false);
		expect(landsOn(filterScrim, point.x, point.y), 'want the filter scrim on top').toBe(true);
		await userEvent.click(filterScrim, { position: point });
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
		expect(onStateChange, 'got the home sheet reacting').not.toHaveBeenCalled();
	});
});

describe('OverlaySheet when open (modal)', () => {
	useViewport(390, 844);

	it('is a modal dialog named by its label', async () => {
		await renderOverlay(true);
		const dialog = page.getByRole('dialog', { name: LABEL, exact: true });
		await expect.element(dialog).toBeInTheDocument();
		expect(dialog.element().getAttribute('aria-modal')).toBe('true');
	});

	it('moves focus into the sheet when it opens', async () => {
		const { opener, sheet, setOpen } = await renderOverlay(false);
		opener.focus();
		await setOpen(true);
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
	});

	it('traps Tab and Shift+Tab inside the sheet', async () => {
		const { sheet } = await renderOverlay(true);
		const controls = contentButtons(sheet);
		controls[controls.length - 1].focus();
		await userEvent.tab();
		expect(focusIsIn(sheet), 'got Tab leaving the sheet').toBe(true);
		controls[0].focus();
		await userEvent.tab({ shift: true });
		expect(focusIsIn(sheet), 'got Shift+Tab leaving the sheet').toBe(true);
	});

	it('asks to close on Escape', async () => {
		const { sheet, onClose } = await renderOverlay(true);
		contentButtons(sheet)[0].focus();
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
	});

	it('returns focus to the opener once closed', async () => {
		const { opener, sheet, onClose, setOpen } = await renderOverlay(false);
		opener.focus();
		await setOpen(true);
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		await userEvent.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
		await setOpen(false);
		await expect.poll(() => document.activeElement, { timeout: 1000 }).toBe(opener);
	});
});

describe('OverlaySheet when closed', () => {
	useViewport(390, 844);

	it('is out of the tab order', async () => {
		const { opener, after } = await renderOverlay(false);
		opener.focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to skip the closed sheet').toBe(after);
	});

	it('is inert', async () => {
		const { sheet } = await renderOverlay(false);
		expect(
			sheet.closest('[inert]'),
			'want the closed sheet inside an inert subtree'
		).not.toBeNull();
	});

	it('is not aria-modal', async () => {
		const { frame } = await renderOverlay(false);
		expect(frame.querySelector('[aria-modal="true"]'), 'got an aria-modal element').toBeNull();
	});
});

describe('OverlaySheet under prefers-reduced-motion: reduce', () => {
	useViewport(390, 844);
	afterEach(resetEmulatedMedia);

	it('does not animate its transform', async () => {
		await emulateReducedMotion('reduce');
		const { sheet } = await renderOverlay(true);
		expect(animates(sheet, 'transform'), 'got a transform transition').toBe(false);
	});

	it(`fades its opacity over ${SHEET_DURATION} instead`, async () => {
		await emulateReducedMotion('reduce');
		const { sheet } = await renderOverlay(true);
		expect(transitionDuration(sheet, 'opacity')).toBe(SHEET_DURATION);
	});

	it('is fully transparent when closed and opaque when open', async () => {
		await emulateReducedMotion('reduce');
		const { sheet, setOpen } = await renderOverlay(true);
		expect(style(sheet, 'opacity')).toBe('1');
		await setOpen(false);
		expect(style(sheet, 'opacity')).toBe('0');
	});
});

// Review / QA findings (FE-3 PR 2). On a landscape phone the filters can be
// taller than the screen: the sheet is capped at its layer's height and
// scrolls inside, so its top (and first filters) stay reachable, and
// focusing a control deep inside never scrolls the layer.
describe('OverlaySheet on a landscape phone (844×390)', () => {
	useViewport(844, 390);

	it('scrolls nothing from the sheet layer up to the screen when a deep control is focused', async () => {
		const { frame, sheet } = await renderOverlay(true, screenFrame(), DEEP_CONTENT_HTML);
		contentRoot(sheet).querySelector('button')!.focus();
		settle();
		const tops = scrollTopsUpTo(sheet.parentElement!, frame);
		expect(tops, 'got a scrolled layer or frame').toEqual(tops.map(() => 0));
		expect(belowRest(sheet, frame)).toBeCloseTo(0, 0);
	});

	it('is fully off screen once closed after that', async () => {
		const { frame, sheet, setOpen } = await renderOverlay(true, screenFrame(), DEEP_CONTENT_HTML);
		contentRoot(sheet).querySelector('button')!.focus();
		settle();
		await setOpen(false);
		const { height } = sheet.getBoundingClientRect();
		expect(belowRest(sheet, frame)).toBeCloseTo(height * 1.1, 0);
	});

	it('is no taller than its layer and starts inside it', async () => {
		const { frame, sheet } = await renderOverlay(true, screenFrame(), TALL_CONTENT_HTML);
		const layer = frame.getBoundingClientRect();
		const rect = sheet.getBoundingClientRect();
		expect(rect.top, 'got the sheet top above the screen').toBeGreaterThanOrEqual(layer.top - 0.5);
		expect(rect.height).toBeCloseTo(layer.height, 0);
	});

	it('scrolls its content internally, containing overscroll', async () => {
		const { sheet } = await renderOverlay(true, screenFrame(), TALL_CONTENT_HTML);
		const scroller = scrollerOf(contentRoot(sheet), sheet);
		expect(scroller.scrollHeight, 'want the content to overflow').toBeGreaterThan(
			scroller.clientHeight
		);
		expect(style(scroller, 'overscroll-behavior-y')).toBe('contain');
	});

	it('shows the first control on screen', async () => {
		const { frame, sheet } = await renderOverlay(true, screenFrame(), TALL_CONTENT_HTML);
		const first = contentButtons(sheet)[0];
		const { left, top, width, height } = first.getBoundingClientRect();
		expect(top).toBeGreaterThanOrEqual(frame.getBoundingClientRect().top);
		expect(
			landsOn(first, left + width / 2, top + height / 2),
			'want the first control tappable'
		).toBe(true);
	});
});

// Opening moves focus in while the sheet still sits 110% below.
describe('OverlaySheet focus on opening', () => {
	useViewport(390, 844);

	it('scrolls nothing from the sheet layer up to the screen', async () => {
		const { frame, opener, sheet, startOpen } = await renderOverlay(false);
		opener.focus();
		await startOpen(true);
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		const tops = scrollTopsUpTo(sheet.parentElement!, frame);
		expect(tops, 'got a scrolled layer or frame').toEqual(tops.map(() => 0));
		settle();
		expect(belowRest(sheet, frame)).toBeCloseTo(0, 0);
	});

	it('is fully off screen once closed again', async () => {
		const { frame, opener, sheet, startOpen, setOpen } = await renderOverlay(false);
		opener.focus();
		await startOpen(true);
		await expect.poll(() => focusIsIn(sheet), { timeout: 1000 }).toBe(true);
		settle();
		await setOpen(false);
		expect(belowRest(sheet, frame)).toBeCloseTo(sheet.getBoundingClientRect().height * 1.1, 0);
	});
});

describe('OverlaySheet and Escape', () => {
	useViewport(390, 844);

	it('calls preventDefault on the Escape it handles', async () => {
		const { sheet } = await renderOverlay(true);
		const control = contentButtons(sheet)[0];
		control.focus();
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		control.dispatchEvent(event);
		expect(event.defaultPrevented, 'want the handled Escape marked').toBe(true);
	});

	it('ignores an Escape already defaultPrevented', async () => {
		const { sheet, onClose } = await renderOverlay(true);
		const control = contentButtons(sheet)[0];
		control.addEventListener('keydown', (event) => event.preventDefault());
		control.focus();
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'got the overlay acting on a handled Escape').not.toHaveBeenCalled();
	});

	it('ignores Escape while closed', async () => {
		const { opener, onClose } = await renderOverlay(false);
		opener.focus();
		await userEvent.keyboard('{Escape}');
		expect(onClose, 'got a closed overlay reacting to Escape').not.toHaveBeenCalled();
	});
});

describe('OverlaySheet closing under prefers-reduced-motion: reduce', () => {
	useViewport(390, 844);
	afterEach(resetEmulatedMedia);

	it('fades out where it rests without moving', async () => {
		await emulateReducedMotion('reduce');
		const { frame, sheet, startOpen } = await renderOverlay(true);
		await startOpen(false);
		expect(transitionRunning(sheet, 'opacity'), 'want an opacity fade').toBe(true);
		expect(transitionRunning(sheet, 'transform'), 'got a transform transition').toBe(false);
		expect(belowRest(sheet, frame)).toBeCloseTo(0, 0);
		for (const animation of sheet.getAnimations()) animation.currentTime = MID_FADE_MS;
		expect(belowRest(sheet, frame), 'got the sheet moving mid-fade').toBeCloseTo(0, 0);
	});

	it('ends transparent and inert after fading out', async () => {
		await emulateReducedMotion('reduce');
		const { sheet, startOpen } = await renderOverlay(true);
		await startOpen(false);
		settle();
		await expect.poll(() => style(sheet, 'opacity'), { timeout: 1000 }).toBe('0');
		await expect.poll(() => sheet.closest('[inert]') !== null, { timeout: 1000 }).toBe(true);
	});
});

// FE-4 PR 3 review: like BottomSheet, a closed OverlaySheet at rest paints
// nothing over the frame (layer, scrim and sheet visibility: hidden, or not
// rendered), so axe can decide the contrast of the page under it; while it
// slides or fades out it stays visible.
describe('OverlaySheet when closed paints nothing over the frame', () => {
	useViewport(390, 844);
	afterEach(() => resetEmulatedMedia());

	it('mounted closed: layer, scrim and sheet are all visibility: hidden', async () => {
		const { frame } = await renderOverlay(false);
		await expect.poll(() => paintingInFrame(frame)).toEqual([]);
	});

	it('open → closed: visible while it slides out, then nothing paints', async () => {
		const { frame, sheet, startOpen } = await renderOverlay(true);
		await startOpen(false);
		expect(style(sheet, 'visibility'), 'want the sheet visible during its slide').toBe('visible');
		settle();
		await expect.poll(() => paintingInFrame(frame)).toEqual([]);
	});

	it('closed → open: the sheet and scrim paint again', async () => {
		const { frame, sheet, setOpen } = await renderOverlay(false);
		await setOpen(true);
		await expect.poll(() => style(sheet, 'visibility')).toBe('visible');
		const scrim = scrimBeside(frame, sheet);
		expect(style(scrim, 'visibility'), 'want the scrim visible when open').toBe('visible');
		expect(landsOn(scrim, ABOVE_SHEET.x, ABOVE_SHEET.y), 'want taps on the scrim').toBe(true);
	});

	it('under reduced motion: nothing paints once the fade ends', async () => {
		await emulateReducedMotion('reduce');
		const { frame, startOpen } = await renderOverlay(true);
		await startOpen(false);
		settle();
		await expect.poll(() => paintingInFrame(frame)).toEqual([]);
	});
});
