import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, parseColour, type Rgba } from '../../testutil/contrast';
import { tokenColour, tokenNumber } from '../../testutil/css-tokens';
import { regionsIn, tileColorOf } from '../../testutil/map';

// FE-4 map labels, WCAG 2.2 AA 1.4.3. The labels are 9.5px/700 (mobile) and
// 12px/700 (desktop): normal text, so 4.5:1. axe can't decide them (their
// translucent background spans several cells: elmPartiallyObscured), so
// home-a11y.e2e.ts skips them and this spec checks every underlay instead.
// A label can sit over any region's tile colour, the same tile dimmed to
// --region-dimmed-opacity over the page while another region is selected
// (D-FE9-3; labels themselves are never dimmed) or a cell gap (--bg-page),
// so its background is the label bg composited over each.
// - Mobile: ink text on --map-label-bg (tokens.css).
// - Desktop: ink text on --map-label-bg-desktop (layout.css, prototype .85);
//   hovered labels turn solid --bg-surface; the selected label is
//   --on-accent text on an ink background.
// Colours are read from the token files, so a token change re-runs the math.

const AA_NORMAL_TEXT = 4.5;

const token = tokenColour;

type Underlay = { name: string; colour: Rgba };

function dimmed(tile: Underlay): Underlay {
	const alpha = tokenNumber('--region-dimmed-opacity');
	return {
		name: `${tile.name} dimmed`,
		colour: composite({ ...tile.colour, a: alpha }, token('--bg-page'))
	};
}

function underlays(): Underlay[] {
	const tiles = regionsIn('en').map((r) => ({
		name: `${r.key} tile`,
		colour: parseColour(tileColorOf(r))
	}));
	return [...tiles, ...tiles.map(dimmed), { name: '--bg-page', colour: token('--bg-page') }];
}

function expectAa(text: Rgba, background: Rgba, what: string) {
	const ratio = contrastRatio(text, background);
	expect(
		ratio,
		`got ${ratio.toFixed(2)}:1 for ${what}, want ≥ ${AA_NORMAL_TEXT}`
	).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
}

describe('map label contrast (AA, normal text)', () => {
	it('covers all 14 region tiles of the mock catalog', () => {
		expect(regionsIn('en').length).toBe(14);
	});

	const labelBgs = ['--map-label-bg', '--map-label-bg-desktop'];
	for (const bg of labelBgs) {
		it(`--ink on ${bg} over every tile, dimmed or not, and the page`, () => {
			for (const underlay of underlays()) {
				expectAa(
					token('--ink'),
					composite(token(bg), underlay.colour),
					`${bg} over ${underlay.name}`
				);
			}
		});
	}

	it('desktop hover: --ink on solid --bg-surface', () => {
		expectAa(token('--ink'), token('--bg-surface'), 'the hovered label');
	});

	it('desktop selected: --on-accent on the ink label', () => {
		expectAa(token('--on-accent'), token('--ink'), 'the selected label');
	});
});
