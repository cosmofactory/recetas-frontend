import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { stage } from '../../testutil/ui';

// FE-3 layout tokens, resolved in a real browser. D-FE3-1 outcome: "At
// 390×844 this is exactly 640 / 330 / 680" — mobile README -> Region sheet:
// "height 640px ... hidden (translateY 680px), peek (translateY 640 − 310 =
// 330px)". On other viewports the sheet follows 76dvh (capped at 640px) and
// the peek stays 310px unless the sheet itself is shorter. The desktop
// padding and gap follow the desktop README's clamp()s.

const DEFAULT_VIEWPORT = { width: 414, height: 896 };

afterEach(() => page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height));

type SheetMetrics = { height: number; peek: number; peekOffset: number; hiddenOffset: number };

function translateY(el: HTMLElement, offset: string): number {
	el.style.transform = `translateY(${offset})`;
	return new DOMMatrix(getComputedStyle(el).transform).m42;
}

function measureSheet(): SheetMetrics {
	const sheet = stage('height: var(--sheet-height)');
	const peek = stage('height: var(--sheet-peek)');
	return {
		height: sheet.getBoundingClientRect().height,
		peek: peek.getBoundingClientRect().height,
		peekOffset: translateY(sheet, 'var(--sheet-offset-peek)'),
		// 100% of a transform is the sheet's own height.
		hiddenOffset: translateY(sheet, 'var(--sheet-offset-hidden)')
	};
}

describe('sheet tokens', () => {
	const viewports: { name: string; width: number; height: number; want: SheetMetrics }[] = [
		{
			name: 'the 390×844 design frame',
			width: 390,
			height: 844,
			want: { height: 640, peek: 310, peekOffset: 330, hiddenOffset: 680 }
		},
		{
			name: 'a 360×640 small phone (76dvh)',
			width: 360,
			height: 640,
			want: { height: 486.4, peek: 310, peekOffset: 176.4, hiddenOffset: 526.4 }
		},
		{
			name: 'a 390×380 short viewport (peek capped at the sheet)',
			width: 390,
			height: 380,
			want: { height: 288.8, peek: 288.8, peekOffset: 0, hiddenOffset: 328.8 }
		}
	];
	for (const { name, width, height, want } of viewports) {
		it(`resolves to ${want.height} / ${want.peekOffset} / ${want.hiddenOffset} at ${name}`, async () => {
			await page.viewport(width, height);
			const got = measureSheet();
			for (const key of Object.keys(want) as (keyof SheetMetrics)[]) {
				expect(got[key], `got ${key} ${got[key]}, want ${want[key]}`).toBeCloseTo(want[key], 1);
			}
		});
	}
});

describe('desktop spacing tokens', () => {
	// clamp(24px, 2.8vw, 40px) and clamp(28px, 3.4vw, 48px).
	const widths: { width: number; padding: number; gap: number }[] = [
		{ width: 860, padding: 24.08, gap: 29.24 },
		{ width: 1280, padding: 35.84, gap: 43.52 },
		{ width: 1440, padding: 40, gap: 48 }
	];
	for (const { width, padding, gap } of widths) {
		it(`gives side padding ${padding}px and gap ${gap}px at ${width}px wide`, async () => {
			await page.viewport(width, 800);
			const el = stage('padding-left: var(--desktop-side-padding); column-gap: var(--desktop-gap)');
			const got = getComputedStyle(el);
			expect(parseFloat(got.paddingLeft), `got padding ${got.paddingLeft}`).toBeCloseTo(padding, 1);
			expect(parseFloat(got.columnGap), `got gap ${got.columnGap}`).toBeCloseTo(gap, 1);
		});
	}
});
