import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, type Rgba } from '../../testutil/contrast';
import { tokenColour } from '../../testutil/css-tokens';

// FE-8 Accessibility: "Contrast check of the token pairs (ink on page,
// on-accent on accent)", against WCAG 2.2 AA (stack.md X10). Colours are read
// from tokens.css, then the layout.css overrides (X10 "Contrast overrides"),
// as the browser applies them. A translucent foreground or backdrop layer is
// composited over the opaque background below it first.
//
// The pairs are the ones the app paints: every text token on the
// backgrounds it sits on (the X10 list first, then the other text colours
// the components use), plus the UI-component boundaries the design draws
// (WCAG 1.4.11, 3:1) and the shared focus ring. All of the app's text is
// under 24px regular / 18.66px bold except the serif titles, which are ink,
// so every text pair is held to the normal-text 4.5:1.

const AA_NORMAL_TEXT = 4.5;
const AA_NON_TEXT = 3;

// A background is a stack of tokens, top first; the last one is opaque.
type Pair = { foreground: string; backdrop: string[]; min: number; where: string };

const PAGE = ['--bg-page'];
const SURFACE = ['--bg-surface'];
const MUTED = ['--bg-surface-muted'];

function textOn(foreground: string, where: string, ...backdrops: string[][]): Pair[] {
	return backdrops.map((backdrop) => ({ foreground, backdrop, min: AA_NORMAL_TEXT, where }));
}

function boundaryOn(foreground: string, where: string, ...backdrops: string[][]): Pair[] {
	return backdrops.map((backdrop) => ({ foreground, backdrop, min: AA_NON_TEXT, where }));
}

// stack.md X10 "Contrast overrides": the agreed list.
const AGREED_PAIRS: Pair[] = [
	...['--ink', '--ink-2', '--ink-3', '--ink-eyebrow'].flatMap((ink) =>
		textOn(ink, 'body text, page and cards', PAGE, SURFACE)
	),
	...textOn('--on-accent', 'filled button label', ['--bg-button'], ['--bg-button-hover']),
	...textOn('--accent-text', 'accent text (counts, Clear all)', PAGE, SURFACE),
	...textOn('--accent-text-hover', 'accent text on hover', PAGE, SURFACE)
];

// Other text colours the components paint, on the backgrounds they paint them on.
const OTHER_TEXT_PAIRS: Pair[] = [
	...textOn('--on-accent', 'pressed chip label (Chip.svelte)', ['--ink']),
	...textOn('--ink-quantity', 'ingredient quantity (IngredientList)', PAGE, SURFACE),
	...textOn('--ink-about', '"How Spain really cooks" paragraph (AboutBlock)', PAGE),
	...textOn('--ink', 'menu row / active search row (LanguageMenu, SearchResultRow)', MUTED),
	...textOn('--ink-2', 'desktop region row description on hover (RegionDishRow)', MUTED),
	...textOn('--ink-3', 'active search result subtitle (SearchResultRow .option.active)', MUTED),
	...textOn('--ink-3', 'language code on a hovered menu row (LanguageMenu .row:hover)', MUTED),
	...textOn(
		'--ink-3',
		'hovered search result subtitle (SearchResultRow .option:hover)',
		['--bg-hover-subtle', '--bg-surface'],
		['--bg-hover-subtle', '--bg-page']
	),
	...textOn('--ink-placeholder', 'search field placeholder (SearchField ::placeholder)', SURFACE)
];

// WCAG 1.4.11: the visible boundary of a control, and the focus indicator.
const NON_TEXT_PAIRS: Pair[] = [
	...boundaryOn('--border-field', 'search field border (SearchField)', PAGE, SURFACE),
	...boundaryOn(
		'--border-chip',
		'chip, icon button and stepper border (Chip, IconButton)',
		PAGE,
		SURFACE
	),
	...boundaryOn('--focus-ring', 'the shared :focus-visible ring (layout.css)', PAGE, SURFACE, MUTED)
];

// The stack composited bottom-up into one opaque colour.
function flatten(backdrop: string[]): Rgba {
	const layers = backdrop.map(tokenColour).reverse();
	return layers.slice(1).reduce((below, layer) => composite(layer, below), layers[0]);
}

function ratioOf({ foreground, backdrop }: Pair): number {
	const bottom = flatten(backdrop);
	return contrastRatio(composite(tokenColour(foreground), bottom), bottom);
}

function describePairs(title: string, pairs: Pair[]) {
	describe(title, () => {
		for (const pair of pairs) {
			const on = pair.backdrop.join(' over ');
			it(`${pair.foreground} on ${on} is ≥ ${pair.min}:1 (${pair.where})`, () => {
				const ratio = ratioOf(pair);
				expect(ratio, `got ${ratio.toFixed(2)}:1, want ≥ ${pair.min}:1`).toBeGreaterThanOrEqual(
					pair.min
				);
			});
		}
	});
}

describePairs('token contrast: the X10 agreed pairs (AA, normal text)', AGREED_PAIRS);
describePairs(
	'token contrast: other text the components paint (AA, normal text)',
	OTHER_TEXT_PAIRS
);
describePairs('token contrast: control boundaries and focus ring (AA, non-text)', NON_TEXT_PAIRS);

describe('token contrast: the stack helper', () => {
	it('flattens a translucent layer over an opaque one', () => {
		const got = flatten(['--bg-hover-subtle', '--bg-surface']);
		const want = composite(tokenColour('--bg-hover-subtle'), tokenColour('--bg-surface'));
		expect(got, 'got a different composite').toEqual(want);
	});
});
