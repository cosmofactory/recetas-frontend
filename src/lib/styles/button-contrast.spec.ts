import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../testutil/contrast';
import { tokenColour } from '../../testutil/css-tokens';

// stack.md X10 "Contrast overrides" (owner, 2026-10-21): filled buttons'
// --on-accent label (14px/600, normal text) must reach WCAG AA 4.5:1 at rest
// and on hover. On the design's --accent it is 3.99:1, hence --bg-button and
// --bg-button-hover.

const AA_NORMAL_TEXT = 4.5;

describe('filled button contrast (AA, normal text)', () => {
	for (const background of ['--bg-button', '--bg-button-hover']) {
		it(`--on-accent on ${background} is ≥ ${AA_NORMAL_TEXT}:1`, () => {
			const ratio = contrastRatio(tokenColour('--on-accent'), tokenColour(background));
			expect(ratio, `got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		});
	}
});
