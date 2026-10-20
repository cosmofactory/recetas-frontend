import { prefersReducedMotion as svelteReducedMotion } from 'svelte/motion';
import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-3 motion: both READMEs -> Accessibility: "Respect
// `prefers-reduced-motion` (swap slides for fades)". src/lib/ui/motion.svelte.ts
// re-exports Svelte's reactive `prefersReducedMotion` (svelte/motion, a
// MediaQuery; not a store) and decides the transition kind with a pure
// `motionFor(reduced)`, so every sheet and page push swaps the same way.

type MotionKind = 'slide' | 'fade';
const MODULE = 'src/lib/ui/motion.svelte.ts';

describe('motionFor', () => {
	const cases: { reduced: boolean; want: MotionKind }[] = [
		{ reduced: false, want: 'slide' },
		{ reduced: true, want: 'fade' }
	];
	for (const { reduced, want } of cases) {
		it(`returns "${want}" when reduced motion is ${reduced ? 'on' : 'off'}`, async () => {
			const motionFor = await loadExport<(reduced: boolean) => MotionKind>(MODULE, 'motionFor');
			expect(motionFor(reduced)).toBe(want);
		});
	}
});

describe('prefersReducedMotion', () => {
	it("is Svelte's own reactive media query, not a copy", async () => {
		const got = await loadExport<unknown>(MODULE, 'prefersReducedMotion');
		expect(got, 'want the svelte/motion prefersReducedMotion').toBe(svelteReducedMotion);
	});
});
