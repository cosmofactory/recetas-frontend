import type { SheetState } from './sheet.ts';

// Dragging the mobile sheet (FE-9 FB-2, D-FE9-1). Offsets are the sheet's
// translateY in CSS px (expanded rests at 0); travel and speed are positive
// downward, as screen coordinates are.

export type Release = { state: SheetState; deltaY: number; velocityY: number };
export type Live = { restingOffset: number; deltaY: number };

// "Threshold 80 px (as 3a's drag-to-dismiss)": exactly 80 snaps back.
const DRAG_THRESHOLD_PX = 80;
// "Or a fast flick": the speed is ours (the spec gives none).
const FLICK_PX_PER_MS = 0.5;
const EXPANDED_OFFSET = 0;

type Direction = 'up' | 'down';

const STEP: Record<Direction, Record<SheetState, SheetState>> = {
	up: { hidden: 'hidden', peek: 'expanded', expanded: 'expanded' },
	down: { hidden: 'hidden', peek: 'hidden', expanded: 'peek' }
};

const signed = (value: number): Direction => (value > 0 ? 'down' : 'up');

// A flick decides first (where the finger was heading as it let go), then
// the travel; neither: no step.
function releaseDirection({ deltaY, velocityY }: Release): Direction | undefined {
	if (Math.abs(velocityY) > FLICK_PX_PER_MS) return signed(velocityY);
	if (Math.abs(deltaY) > DRAG_THRESHOLD_PX) return signed(deltaY);
	return undefined;
}

// The state the sheet snaps to on release: one step at most.
export function releaseTarget(release: Release): SheetState {
	const direction = releaseDirection(release);
	return direction === undefined ? release.state : STEP[direction][release.state];
}

// Where the sheet is while the pointer is down: never above expanded.
export function liveOffset({ restingOffset, deltaY }: Live): number {
	return Math.max(EXPANDED_OFFSET, restingOffset + deltaY);
}
