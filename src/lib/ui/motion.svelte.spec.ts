import { afterEach, describe, expect, it } from 'vitest';
import { emulateReducedMotion, loadUiExport, resetEmulatedMedia } from '../../testutil/ui';

// FE-3 acceptance: "With `prefers-reduced-motion: reduce` emulated, there are
// no transform animations, only fades." The exported prefersReducedMotion
// follows the user's setting live, and motionFor turns it into a fade.

type ReducedMotion = { current: boolean };
type MotionFor = (reduced: boolean) => 'slide' | 'fade';
const MODULE = 'motion.svelte.ts';

afterEach(resetEmulatedMedia);

describe('prefersReducedMotion in the browser', () => {
	const settings = [
		{ value: 'reduce', reduced: true, kind: 'fade' },
		{ value: 'no-preference', reduced: false, kind: 'slide' }
	] as const;
	for (const { value, reduced, kind } of settings) {
		it(`reads ${reduced} and picks "${kind}" under prefers-reduced-motion: ${value}`, async () => {
			const motion = await loadUiExport<ReducedMotion>(MODULE, 'prefersReducedMotion');
			const motionFor = await loadUiExport<MotionFor>(MODULE, 'motionFor');
			await emulateReducedMotion(value);
			expect(motion.current).toBe(reduced);
			expect(motionFor(motion.current)).toBe(kind);
		});
	}
});
