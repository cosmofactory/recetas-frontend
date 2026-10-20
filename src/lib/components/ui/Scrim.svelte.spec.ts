import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { appendButton, landsOn, settle } from '../../../testutil/sheet';
import { computed, loadUi, stage, style, transitionDuration } from '../../../testutil/ui';

// FE-3 Scrim: the dimming layer behind a sheet. Stage FE-3: "opacity levels
// from the tokens, clickable only while visible".
// - Mobile README -> Region sheet: "Scrim behind the sheet: `--scrim`, opacity
//   0.18 at peek, 0.45 expanded, 400ms. Clickable only when the sheet is
//   visible." (the levels come from sheetScrimOpacity, src/lib/ui/sheet.ts).
// - Mobile README -> Filters sheet: "Scrim `--scrim-filter`, 300ms, tap
//   closes." The prototype draws it at opacity 1 when open
//   (`scrimStyle: ...rgba(30,20,12,.45)...opacity: open ? 1 : 0`).
// The prototype's scrim is `position:absolute; inset:0`: it covers its
// positioned container. It is decoration for pointer users, so it is
// aria-hidden and never focusable (Escape is the keyboard way out).
//
// Props: `variant` picks the colour and duration ("sheet" is the default),
// `opacity` the level (0 = hidden), `onclick` the tap.

type ScrimProps = { variant?: 'sheet' | 'filter'; opacity: number; onclick?: () => void };

async function renderScrim(props: ScrimProps) {
	const Scrim = await loadUi<ScrimProps>('Scrim');
	const frame = stage('position: relative; width: 300px; height: 200px; padding: 0');
	const before = appendButton(frame, 'Before');
	await render(Scrim, { target: frame, props });
	const after = appendButton(frame, 'After');
	const scrim = frame.querySelector<HTMLElement>('[aria-hidden="true"]');
	expect(scrim, 'got no aria-hidden scrim element').not.toBeNull();
	settle();
	return { frame, before, after, scrim: scrim! };
}

function centreOf(el: Element) {
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('Scrim variants', () => {
	const variants = [
		{ variant: 'sheet', token: '--scrim', duration: '0.4s' },
		{ variant: 'filter', token: '--scrim-filter', duration: '0.3s' }
	] as const;
	for (const { variant, token, duration } of variants) {
		it(`"${variant}" is filled with ${token}`, async () => {
			const { scrim } = await renderScrim({ variant, opacity: 1 });
			const want = computed('background-color', `var(${token})`);
			expect(style(scrim, 'background-color'), `want ${token}`).toBe(want);
		});

		it(`"${variant}" fades its opacity over ${duration}`, async () => {
			const { scrim } = await renderScrim({ variant, opacity: 1 });
			expect(transitionDuration(scrim, 'opacity')).toBe(duration);
		});
	}

	it('defaults to the sheet variant (--scrim)', async () => {
		const { scrim } = await renderScrim({ opacity: 1 });
		expect(style(scrim, 'background-color')).toBe(computed('background-color', 'var(--scrim)'));
	});
});

describe('Scrim levels', () => {
	for (const opacity of [0, 0.18, 0.45, 1]) {
		it(`draws at opacity ${opacity}`, async () => {
			const { scrim } = await renderScrim({ opacity });
			expect(parseFloat(style(scrim, 'opacity'))).toBeCloseTo(opacity, 5);
		});
	}

	it('covers its positioned container', async () => {
		const { frame, scrim } = await renderScrim({ opacity: 0.45 });
		const got = scrim.getBoundingClientRect();
		const want = frame.getBoundingClientRect();
		expect([got.left, got.top, got.width, got.height]).toEqual([
			want.left,
			want.top,
			want.width,
			want.height
		]);
	});
});

describe('Scrim taps', () => {
	it('calls onclick when tapped while visible', async () => {
		const onclick = vi.fn();
		const { scrim } = await renderScrim({ opacity: 0.18, onclick });
		const { x, y } = centreOf(scrim);
		expect(landsOn(scrim, x, y), 'want a tap to land on the visible scrim').toBe(true);
		await userEvent.click(scrim);
		expect(onclick, 'want one onclick call').toHaveBeenCalledTimes(1);
	});

	it('lets taps through while hidden (pointer-events: none)', async () => {
		const onclick = vi.fn();
		const { scrim } = await renderScrim({ opacity: 0, onclick });
		expect(style(scrim, 'pointer-events')).toBe('none');
		const { x, y } = centreOf(scrim);
		expect(landsOn(scrim, x, y), 'got a tap landing on the hidden scrim').toBe(false);
		document.elementFromPoint(x, y)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onclick, 'want no onclick call while hidden').not.toHaveBeenCalled();
	});
});

describe('Scrim semantics', () => {
	it('is hidden from assistive tech', async () => {
		const { scrim } = await renderScrim({ opacity: 0.45 });
		expect(scrim.getAttribute('aria-hidden')).toBe('true');
	});

	it('is not in the tab order', async () => {
		const { before, after } = await renderScrim({ opacity: 0.45, onclick: () => {} });
		before.focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to skip the scrim').toBe(after);
	});
});
