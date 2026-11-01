import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { bindShortWords } from '#lib/i18n/typography.ts';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { ABOUT_COPY, ABOUT_LOCALES, type AboutLocale } from '../../../testutil/about-copy';
import { computed, loadHome, stage, style, useViewport } from '../../../testutil/ui';

// FE-9 FB-8 (D-FE9-4), AboutBlock: the "How Spain really cooks" intro under
// the Regional map, now on both layouts.
//
// Sources:
// - Mobile README -> Screen 1 -> Regional tab — body: "About (D-FE9-4),
//   below the map, reached by scrolling: top hairline, title "How Spain
//   really cooks" (Instrument Serif ≈28px) and the description paragraph
//   (≈14px, lh ≈1.55, ink-2), stacked. Copy in strings.json → home
//   (aboutTitle, aboutBody), shared with desktop. Regional tab only. The
//   title is the page's one h1; the logo isn't a heading."
// - Desktop README -> Regional: unchanged two columns (home-regional.e2e.ts
//   pins its geometry; here only that it is still two columns).
//
// Decisions pinned here:
// - One AboutBlock for both layouts (like the map): the server renders both
//   layouts in one HTML, so two blocks would mean two <h1>s.
// - The ≈ values are checked loosely (28 ± 2px, 14 ± 1px, line-height
//   1.55 ± 0.1); ink-2 is the --ink-2 token (with its X10 AA override).
// - "Top hairline": the same rule as desktop's, --border-about (1px solid).
//   Assumption: the mobile README doesn't name the token; desktop's block
//   already draws its hairline with it.

const MOBILE_WIDTHS = [360, 390, 859];
const TITLE_PX = { want: 28, tolerance: 2 };
const BODY_PX = { want: 14, tolerance: 1 };
const BODY_LINE_HEIGHT = { want: 1.55, tolerance: 0.1 };

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

type Parts = { root: HTMLElement; title: HTMLElement; body: HTMLElement };

async function renderAbout(lang: AboutLocale = 'en'): Promise<Parts> {
	overwriteGetLocale(() => lang);
	const AboutBlock = await loadHome<Record<string, never>>('AboutBlock');
	const target = stage('padding: 0 16px; background: var(--bg-page)');
	render(AboutBlock, { target });
	const root = target.firstElementChild as HTMLElement;
	expect(root, 'got no AboutBlock root element').not.toBeNull();
	const title = root.querySelector('h1') as HTMLElement;
	expect(title, 'got no <h1> in AboutBlock').not.toBeNull();
	const body = root.querySelector('p') as HTMLElement;
	expect(body, 'got no paragraph in AboutBlock').not.toBeNull();
	return { root, title, body };
}

const px = (el: Element, property: string) => parseFloat(style(el, property));

function expectNear(got: number, want: number, tolerance: number, what: string) {
	expect(
		Math.abs(got - want),
		`got ${what} ${got}, want ${want} ± ${tolerance}`
	).toBeLessThanOrEqual(tolerance);
}

describe('AboutBlock copy', () => {
	for (const lang of ABOUT_LOCALES) {
		const copy = ABOUT_COPY[lang];
		it(`${lang}: the <h1> reads "${copy.title}" and the paragraph the about copy`, async () => {
			const { title, body } = await renderAbout(lang);
			expect(title.textContent?.trim()).toBe(bindShortWords(copy.title, lang));
			expect(body.textContent?.trim()).toBe(bindShortWords(copy.body, lang));
		});
	}
});

describe('AboutBlock on mobile', () => {
	for (const width of MOBILE_WIDTHS) {
		describe(`${width}px wide`, () => {
			useViewport(width, 800);

			it('is shown: the block, its title and its paragraph are visible', async () => {
				const { root, title, body } = await renderAbout();
				expect(root.checkVisibility(), 'got the block hidden on mobile').toBe(true);
				expect(title.checkVisibility(), 'got the title hidden on mobile').toBe(true);
				expect(body.checkVisibility(), 'got the paragraph hidden on mobile').toBe(true);
			});

			it('stacks the paragraph under the title, both left-aligned', async () => {
				const { title, body } = await renderAbout();
				const t = title.getBoundingClientRect();
				const b = body.getBoundingClientRect();
				expect(t.height * b.height, 'got a title or paragraph with no box').toBeGreaterThan(0);
				expect(
					b.top,
					`got paragraph top ${b.top}, want >= title bottom ${t.bottom}`
				).toBeGreaterThanOrEqual(t.bottom - 0.5);
				expectNear(b.left, t.left, 0.5, 'paragraph left vs title left');
			});
		});
	}

	describe('390px styles', () => {
		useViewport(390, 844);

		it('draws a 1px solid top hairline in --border-about', async () => {
			const { root } = await renderAbout();
			expect(style(root, 'border-top-style')).toBe('solid');
			expect(style(root, 'border-top-width')).toBe('1px');
			const want = computed('border-top-color', 'var(--border-about)', 'border-top-style: solid');
			expect(style(root, 'border-top-color')).toBe(want);
		});

		it(`sets the title in Instrument Serif at ≈${TITLE_PX.want}px`, async () => {
			const { title } = await renderAbout();
			expect(style(title, 'font-family').replace(/["']/g, '')).toMatch(/^Instrument Serif\s*,/);
			expectNear(px(title, 'font-size'), TITLE_PX.want, TITLE_PX.tolerance, 'title font-size');
		});

		it(`sets the paragraph at ≈${BODY_PX.want}px, line-height ≈${BODY_LINE_HEIGHT.want}, in --ink-2`, async () => {
			const { body } = await renderAbout();
			const size = px(body, 'font-size');
			expectNear(size, BODY_PX.want, BODY_PX.tolerance, 'paragraph font-size');
			const ratio = px(body, 'line-height') / size;
			expectNear(ratio, BODY_LINE_HEIGHT.want, BODY_LINE_HEIGHT.tolerance, 'line-height ratio');
			expect(style(body, 'color')).toBe(computed('color', 'var(--ink-2)'));
		});
	});
});

describe('AboutBlock on desktop (unchanged)', () => {
	useViewport(1280, 800);

	it('keeps two columns: the paragraph beside the title, tops aligned', async () => {
		const { title, body } = await renderAbout();
		const t = title.getBoundingClientRect();
		const b = body.getBoundingClientRect();
		expect(
			b.left,
			`got paragraph left ${b.left}, want right of the title (${t.right})`
		).toBeGreaterThan(t.right);
		expect(b.top, 'got the paragraph below the title on desktop').toBeLessThan(t.bottom);
	});
});
