import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../testutil/contrast';
import { tokenColour } from '../../testutil/css-tokens';

// stack.md X10 "Contrast overrides" (owner, 2026-10-21; amended in FE-5):
// accent-coloured text (counts, "Clear all", 12px/600, normal text) sits on
// the surface (cards, sheets) and on the page (the Popular empty state), so
// --accent-text and its hover --accent-text-hover must reach WCAG AA 4.5:1
// on both.

const AA_NORMAL_TEXT = 4.5;

describe('accent text contrast (AA, normal text)', () => {
	const pairs = ['--accent-text', '--accent-text-hover'].flatMap((text) =>
		['--bg-page', '--bg-surface'].map((background) => ({ text, background }))
	);
	for (const { text, background } of pairs) {
		it(`${text} on ${background} is ≥ ${AA_NORMAL_TEXT}:1`, () => {
			const ratio = contrastRatio(tokenColour(text), tokenColour(background));
			expect(ratio, `got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		});
	}
});
