// Both READMEs -> Accessibility: under prefers-reduced-motion, slides become
// fades. Every sheet and page push asks motionFor, so they all swap alike.
export { prefersReducedMotion } from 'svelte/motion';

export type MotionKind = 'slide' | 'fade';

export function motionFor(reduced: boolean): MotionKind {
	return reduced ? 'fade' : 'slide';
}
