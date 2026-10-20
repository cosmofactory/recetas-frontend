import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
	animates,
	computed,
	emulateReducedMotion,
	resetEmulatedMedia,
	stage,
	style,
	transitionDuration,
	ungatedHoverRules,
	useViewport
} from '../../testutil/ui';

// FE-3 Delivery 4: the desktop layout tokens in use, as global utility
// classes in src/lib/styles/layout.css (loaded app-wide). Classes, not
// wrapper components, because the prototype puts the width cap, the padding
// and the screen's own grid on one element (Asadorov Desktop.dc.html l.84,
// 137, 182, 209: `max-width:1440px; margin:0 auto; padding:28px
// clamp(24px,2.8vw,40px) …; box-sizing:border-box; display:grid; …`), so a
// screen adds `class="page-container"` next to its own grid class.
//
// .page-container  Desktop README -> Layout: "Content max-width 1440px,
//                  centred. Side padding … clamp(24px, 2.8vw, 40px)". From
//                  860px only; the 1440px includes the padding (prototype
//                  box-sizing:border-box). The gaps differ per screen (the
//                  Regional and Popular grids use --desktop-gap, Variations
//                  and Recipe 30px), so the container sets none.
// .hover-lift      Desktop README -> Popular: card "hover lifts 2px with
//                  shadow 0 10px 26px rgba(43,30,22,.1)" (= --shadow-card-
//                  hover); prototype l.158/194 `transition:transform .2s,
//                  box-shadow .2s` (200ms = --dur-colour). Hover styles only
//                  under (hover: hover) (FE-3 Desktop tasks), and no
//                  transform animation under reduced motion (Acceptance).
// .desktop-only /  The one CSS breakpoint helper ("a single breakpoint, used
// .mobile-only     through one media-query helper"): shown from 860px /
//                  below 860px, matching desktopQuery (#lib/ui/breakpoints.ts).

const CONTENT_MAX_PX = 1440;
const LIFT_PX = -2;
const HOVER_MS = '0.2s';

// Rounded to 2 decimals, the precision the assertions compare at.
const clamp = (min: number, value: number, max: number) =>
	Number(Math.min(Math.max(value, min), max).toFixed(2));
const sidePadding = (vw: number) => clamp(24, 0.028 * vw, 40);

function element(className: string, target = stage('padding: 0')): HTMLElement {
	const el = document.createElement('div');
	el.className = className;
	el.style.height = '100px';
	target.append(el);
	return el;
}

for (const vw of [860, 1280, 1440, 1600]) {
	describe(`.page-container at ${vw}px wide`, () => {
		useViewport(vw, 800);

		const width = Math.min(vw, CONTENT_MAX_PX);
		const left = (vw - width) / 2;

		it(`is ${width}px wide at x = ${left} (max-width 1440px incl. padding, centred)`, async () => {
			const target = stage('padding: 0');
			const rect = element('page-container', target).getBoundingClientRect();
			const want = Math.min(target.clientWidth, CONTENT_MAX_PX);
			const wantLeft = (target.clientWidth - want) / 2;
			expect(rect.width, `got width ${rect.width}, want ${want}`).toBeCloseTo(want, 1);
			expect(rect.left, `got left ${rect.left}, want ${wantLeft}`).toBeCloseTo(wantLeft, 1);
		});

		it(`pads ${sidePadding(vw)}px on each side (--desktop-side-padding)`, async () => {
			const el = element('page-container');
			for (const side of ['left', 'right']) {
				const got = parseFloat(style(el, `padding-${side}`));
				expect(got, `got padding-${side} ${got}`).toBeCloseTo(sidePadding(vw), 1);
			}
		});
	});
}

describe('.page-container below 860px', () => {
	useViewport(859, 800);

	it('applies no desktop side padding (the mobile screens set their own)', async () => {
		const el = element('page-container');
		expect([style(el, 'padding-left'), style(el, 'padding-right')]).toEqual(['0px', '0px']);
	});
});

describe('.hover-lift', () => {
	useViewport(1280, 800);
	afterEach(resetEmulatedMedia);

	it('rests unlifted, without a shadow', async () => {
		const card = element('hover-lift');
		expect(style(card, 'transform')).toBe('none');
		expect(style(card, 'box-shadow')).toBe('none');
	});

	it('lifts 2px with --shadow-card-hover on hover', async () => {
		const card = element('hover-lift');
		await userEvent.hover(card);
		await expect.poll(() => new DOMMatrix(style(card, 'transform')).m42).toBe(LIFT_PX);
		await expect
			.poll(() => style(card, 'box-shadow'))
			.toBe(computed('box-shadow', 'var(--shadow-card-hover)'));
	});

	it('styles :hover only under (hover: hover), so touch never lifts', async () => {
		const card = element('hover-lift');
		const rules = ungatedHoverRules(card);
		expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
	});

	it(`animates transform and box-shadow over ${HOVER_MS} (--dur-colour)`, async () => {
		const card = element('hover-lift');
		const want = computed('transition-duration', 'var(--dur-colour)');
		expect(transitionDuration(card, 'transform'), 'transform duration').toBe(want);
		expect(transitionDuration(card, 'box-shadow'), 'box-shadow duration').toBe(want);
	});

	it('does not animate the transform under reduced motion', async () => {
		await emulateReducedMotion('reduce');
		const card = element('hover-lift');
		expect(animates(card, 'transform'), 'got a transform transition under reduce').toBe(false);
	});

	// FE-3 review: under reduced motion the card doesn't move at all; only the
	// shadow changes.
	it('keeps transform none on hover under reduced motion, changing only the shadow', async () => {
		await emulateReducedMotion('reduce');
		const card = element('hover-lift');
		await userEvent.hover(card);
		await expect
			.poll(() => style(card, 'box-shadow'))
			.toBe(computed('box-shadow', 'var(--shadow-card-hover)'));
		expect(style(card, 'transform'), 'got a hover transform under reduce').toBe('none');
	});
});

const VISIBILITY = [
	{ width: 859, desktop: false },
	{ width: 860, desktop: true },
	{ width: 1440, desktop: true },
	{ width: 390, desktop: false }
];

for (const { width, desktop } of VISIBILITY) {
	describe(`breakpoint utilities at ${width}px wide`, () => {
		useViewport(width, 800);

		it(`${desktop ? 'shows' : 'hides'} .desktop-only`, async () => {
			const el = element('desktop-only');
			expect(el.checkVisibility(), `got .desktop-only display ${style(el, 'display')}`).toBe(
				desktop
			);
		});

		it(`${desktop ? 'hides' : 'shows'} .mobile-only`, async () => {
			const el = element('mobile-only');
			expect(el.checkVisibility(), `got .mobile-only display ${style(el, 'display')}`).toBe(
				!desktop
			);
		});
	});
}
