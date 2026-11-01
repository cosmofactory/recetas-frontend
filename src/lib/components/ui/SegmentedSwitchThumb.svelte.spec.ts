import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import {
	computed,
	emulateReducedMotion,
	loadUi,
	resetEmulatedMedia,
	stage,
	style,
	transitionDuration,
	transitionTimingFunction
} from '../../../testutil/ui';

// FE-9 FB-3, spec addition D-FE9-2 (owner, 2026-11-01): "One thumb
// (`--bg-surface`, radius 9px, the spec's shadow) slides under the labels to
// the chosen segment (~250 ms, `--ease`) ... Instant under
// `prefers-reduced-motion`." The look is the mobile README's active segment
// (Header item 2: "Active: bg `--bg-surface`, radius 9px, shadow
// `--shadow-segment-active`"), now painted by one element that moves instead
// of a background that fades between segments.
//
// Contract for the test: the thumb is the one element with
// data-testid="segment-thumb" inside the switch; it is decorative (not a
// tab, no text, not focusable). At rest its border box is the active
// segment's border box exactly, in both states, at every switch width and
// for the long ru labels (Localization -> Length: segment labels must not
// truncate; SegmentedSwitch.svelte.spec.ts covers that).

type Option = { value: string; label: string; href?: string };
type SwitchProps = {
	options: Option[];
	value: string;
	label: string;
	onChange?: (value: string) => void;
	size?: 'regular' | 'desktop';
};

const TABS: Option[] = [
	{ value: 'regional', label: 'Regional' },
	{ value: 'popular', label: 'Popular' }
];
const RU_TABS: Option[] = [
	{ value: 'regional', label: 'По регионам' },
	{ value: 'popular', label: 'Популярное' }
];
const THREE: Option[] = [
	{ value: 'diet', label: 'Diet' },
	{ value: 'course', label: 'Course' },
	{ value: 'season', label: 'Season' }
];
const SWITCH_LABEL = 'Browse';
const THUMB = '[data-testid="segment-thumb"]';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
// D-FE9-2: "~250 ms". Assumption: exactly 250ms (a layout.css token), as
// the design has no duration token for it.
const SLIDE_DURATION = '0.25s';
// Properties the thumb may move with; at least one must carry the slide.
const MOVEMENT_PROPERTIES = ['transform', 'translate', 'left', 'inset-inline-start'];
const PX_TOLERANCE = 0.5;

// Switch widths: desktop top bar clamp(240px, 22vw, 320px) at both ends,
// and the mobile header's full width at 390px (390 − 2 × 20px padding).
const WIDTHS = { desktopMin: 240, desktopMax: 320, mobile390: 350 };

async function renderSwitch(props: Partial<SwitchProps> = {}, width = WIDTHS.desktopMin) {
	const SegmentedSwitch = await loadUi<SwitchProps>('SegmentedSwitch');
	const all: SwitchProps = { options: TABS, value: TABS[0].value, label: SWITCH_LABEL, ...props };
	const target = stage(`width: ${width}px; padding: 40px 0`);
	await render(SegmentedSwitch, { target, props: all });
	await expect.element(page.getByRole('tablist', { name: SWITCH_LABEL })).toBeInTheDocument();
	const tabs = all.options.map(
		(o) => page.getByRole('tab', { name: o.label, exact: true }).element() as HTMLElement
	);
	return { target, tabs };
}

function thumbsIn(target: HTMLElement): HTMLElement[] {
	return [...target.querySelectorAll<HTMLElement>(THUMB)];
}

function theThumb(target: HTMLElement): HTMLElement {
	const thumbs = thumbsIn(target);
	expect(thumbs.length, `got ${thumbs.length} elements ${THUMB}, want exactly one`).toBe(1);
	return thumbs[0];
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Waits until layout and style have caught up, then for every running
// animation or transition on the thumb to finish.
async function atRest(thumb: HTMLElement) {
	await nextFrame();
	await nextFrame();
	await Promise.all(thumb.getAnimations({ subtree: true }).map((a) => a.finished));
}

function expectSameBox(thumb: HTMLElement, tab: HTMLElement, what: string) {
	const got = thumb.getBoundingClientRect();
	const want = tab.getBoundingClientRect();
	for (const side of ['left', 'top', 'width', 'height'] as const) {
		const delta = Math.abs(got[side] - want[side]);
		expect(
			delta,
			`${what}: got thumb ${side} ${got[side]}px, want the active segment's ${want[side]}px`
		).toBeLessThanOrEqual(PX_TOLERANCE);
	}
}

async function select(tab: HTMLElement) {
	await page.elementLocator(tab).click();
	await expect.element(page.elementLocator(tab)).toHaveAttribute('aria-selected', 'true');
}

// The movement property that animates, with its duration and timing.
function slideTransition(thumb: HTMLElement): { duration?: string; timing?: string } {
	const moving = MOVEMENT_PROPERTIES.find(
		(p) => parseFloat(transitionDuration(thumb, p) ?? '0') > 0
	);
	if (moving === undefined) return {};
	return {
		duration: transitionDuration(thumb, moving),
		timing: transitionTimingFunction(thumb, moving)
	};
}

describe('SegmentedSwitch thumb: one element', () => {
	const cases: { name: string; options: Option[]; value: string }[] = [
		{ name: 'two segments, first selected', options: TABS, value: 'regional' },
		{ name: 'two segments, second selected', options: TABS, value: 'popular' },
		{ name: 'three segments, middle selected', options: THREE, value: 'course' }
	];
	for (const { name, options, value } of cases) {
		it(`renders exactly one thumb (${name})`, async () => {
			const { target } = await renderSwitch({ options, value });
			theThumb(target);
		});
	}

	it('keeps the same thumb element when the selection changes', async () => {
		const { target, tabs } = await renderSwitch();
		const before = theThumb(target);
		await select(tabs[1]);
		expect(theThumb(target), 'got a new thumb element, want one that moves').toBe(before);
	});

	it('is decorative: not a tab, no text, not focusable', async () => {
		const { target } = await renderSwitch();
		const thumb = theThumb(target);
		expect(thumb.closest('[role="tab"]'), 'got the thumb inside a tab').toBeNull();
		expect(thumb.textContent?.trim(), 'got text in the thumb').toBe('');
		expect(thumb.tabIndex, 'got a focusable thumb').toBeLessThan(0);
	});
});

describe('SegmentedSwitch thumb: look', () => {
	// "Active: bg --bg-surface, radius 9px, shadow --shadow-segment-active".
	it('paints --bg-surface, radius 9px (--radius-segment) and --shadow-segment-active', async () => {
		const { target } = await renderSwitch({ value: 'popular' });
		const thumb = theThumb(target);
		const got = ['background-color', 'border-top-left-radius', 'box-shadow'].map((p) =>
			style(thumb, p)
		);
		expect(got).toEqual([
			computed('background-color', 'var(--bg-surface)'),
			computed('border-top-left-radius', 'var(--radius-segment)'),
			computed('box-shadow', 'var(--shadow-segment-active)')
		]);
	});

	// "One thumb": the segments themselves no longer paint a surface, or the
	// old per-segment fade would still show under the sliding thumb.
	for (const value of ['regional', 'popular']) {
		it(`leaves every segment unpainted with ${value} selected`, async () => {
			const { tabs } = await renderSwitch({ value });
			for (const tab of tabs) {
				const got = [style(tab, 'background-color'), style(tab, 'box-shadow')];
				expect(got, `got "${tab.textContent?.trim()}" painted`).toEqual([TRANSPARENT, 'none']);
			}
		});
	}

	// "slides under the labels": the labels stay on top and take the press.
	it('sits under the labels: a press on the active label lands on its tab', async () => {
		const { tabs } = await renderSwitch({ value: 'popular' });
		const box = tabs[1].getBoundingClientRect();
		const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
		expect(hit !== null && (hit === tabs[1] || tabs[1].contains(hit)), 'got the thumb on top').toBe(
			true
		);
	});
});

describe('SegmentedSwitch thumb: box at rest matches the active segment', () => {
	type Case = { width: number; size: 'regular' | 'desktop'; options: Option[]; where: string };
	const layouts: Case[] = [
		{ width: WIDTHS.mobile390, size: 'regular', options: TABS, where: 'mobile 390, en' },
		{ width: WIDTHS.mobile390, size: 'regular', options: RU_TABS, where: 'mobile 390, ru' },
		{ width: WIDTHS.desktopMin, size: 'desktop', options: TABS, where: 'desktop 240px, en' },
		{ width: WIDTHS.desktopMin, size: 'desktop', options: RU_TABS, where: 'desktop 240px, ru' },
		{ width: WIDTHS.desktopMax, size: 'desktop', options: RU_TABS, where: 'desktop 320px, ru' }
	];
	for (const { width, size, options, where } of layouts) {
		for (const [index, option] of options.entries()) {
			it(`${where}: rests on "${option.label}" when it is the value`, async () => {
				const { target, tabs } = await renderSwitch({ options, size, value: option.value }, width);
				const thumb = theThumb(target);
				await atRest(thumb);
				expectSameBox(thumb, tabs[index], `${where}, ${option.value}`);
			});
		}

		it(`${where}: rests on the second segment after selecting it`, async () => {
			const { target, tabs } = await renderSwitch({ options, size }, width);
			await select(tabs[1]);
			const thumb = theThumb(target);
			await atRest(thumb);
			expectSameBox(thumb, tabs[1], `${where}, after a click`);
		});
	}

	it('rests on the middle of three segments', async () => {
		const { target, tabs } = await renderSwitch({ options: THREE, value: 'course' });
		const thumb = theThumb(target);
		await atRest(thumb);
		expectSameBox(thumb, tabs[1], 'three segments, middle');
	});

	// Crossing a width (rotating the phone, resizing the window) changes the
	// segments' size; the thumb must follow, not keep the old measurement.
	it('still matches the active segment after the switch is resized', async () => {
		const { target, tabs } = await renderSwitch({ value: 'popular' }, WIDTHS.desktopMin);
		target.style.width = `${WIDTHS.mobile390}px`;
		const thumb = theThumb(target);
		await atRest(thumb);
		expectSameBox(thumb, tabs[1], 'after resizing 240px → 350px');
	});

	it('follows the value prop when the caller changes it (keyboard, URL)', async () => {
		const SegmentedSwitch = await loadUi<SwitchProps>('SegmentedSwitch');
		const props: SwitchProps = { options: TABS, value: 'regional', label: SWITCH_LABEL };
		const target = stage(`width: ${WIDTHS.mobile390}px; padding: 40px 0`);
		const { rerender } = await render(SegmentedSwitch, { target, props });
		const popular = page.getByRole('tab', { name: 'Popular', exact: true });
		await rerender({ value: 'popular' });
		await expect.element(popular).toHaveAttribute('aria-selected', 'true');
		const thumb = theThumb(target);
		await atRest(thumb);
		expectSameBox(thumb, popular.element() as HTMLElement, 'after the value prop changed');
	});
});

describe('SegmentedSwitch thumb: motion', () => {
	afterEach(() => resetEmulatedMedia());

	it(`slides with a ${SLIDE_DURATION} --ease transition on its movement`, async () => {
		await emulateReducedMotion('no-preference');
		const { target } = await renderSwitch();
		const got = slideTransition(theThumb(target));
		expect(got, `want one of ${MOVEMENT_PROPERTIES} to transition`).toEqual({
			duration: SLIDE_DURATION,
			timing: computed('transition-timing-function', 'var(--ease)')
		});
	});

	it('is still on its way one frame after a click (it slides, it does not jump)', async () => {
		await emulateReducedMotion('no-preference');
		const { target, tabs } = await renderSwitch({}, WIDTHS.mobile390);
		await select(tabs[1]);
		await nextFrame();
		const running = theThumb(target).getAnimations({ subtree: true });
		expect(running.length, 'got no running transition on the thumb').toBeGreaterThan(0);
	});

	it('moves instantly under prefers-reduced-motion: no transition on its movement', async () => {
		await emulateReducedMotion('reduce');
		const { target } = await renderSwitch();
		expect(slideTransition(theThumb(target)), 'got a slide under reduced motion').toEqual({});
	});

	it('under reduced motion is on the new segment one frame after a click', async () => {
		await emulateReducedMotion('reduce');
		const { target, tabs } = await renderSwitch({}, WIDTHS.mobile390);
		await select(tabs[1]);
		await nextFrame();
		const thumb = theThumb(target);
		expect(thumb.getAnimations({ subtree: true }).length, 'got a running animation').toBe(0);
		expectSameBox(thumb, tabs[1], 'reduced motion, one frame after the click');
	});
});
