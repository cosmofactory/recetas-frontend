import { afterEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { loadUiExport } from '../../testutil/ui';

// FE-3 acceptance: "With `prefers-reduced-motion: reduce` emulated, there are
// no transform animations, only fades." The exported prefersReducedMotion
// follows the user's setting live, and motionFor turns it into a fade.

type ReducedMotion = { current: boolean };
type MotionFor = (reduced: boolean) => 'slide' | 'fade';
const MODULE = 'motion.svelte.ts';

function emulateReducedMotion(value: 'reduce' | 'no-preference') {
	return cdp().send('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-motion', value }]
	});
}

afterEach(() => cdp().send('Emulation.setEmulatedMedia', { features: [] }));

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
