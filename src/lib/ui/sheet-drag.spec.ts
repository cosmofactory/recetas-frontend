import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-9 FB-2, spec addition D-FE9-1 (owner, 2026-11-01): the region sheet
// (and every BottomSheet) can be dragged by its handle and header.
// - "The sheet follows the finger (no transition while dragging)."
// - "On release, it snaps: up from peek → expanded; down from expanded →
//   peek; down from peek → hidden and the region is deselected (as the
//   scrim tap)."
// - "Threshold 80 px (as 3a's drag-to-dismiss), or a fast flick; otherwise
//   it snaps back."
//
// The pure math lives in src/lib/ui/sheet-drag.ts:
// - releaseTarget({ state, deltaY, velocityY }): the state the sheet snaps
//   to when the pointer is released. deltaY is the pointer's travel since
//   the press, in CSS px, positive downward (screen coordinates); velocityY
//   is its speed at release in px/ms, positive downward.
// - liveOffset({ restingOffset, deltaY }): the sheet's translateY while the
//   pointer is down: its resting offset for the current state plus the
//   travel, never above the expanded position (0), unbounded downward.
//
// Pinned numbers: 80px from the spec ("|drag| > 80": exactly 80 snaps
// back, as 3a's "> 80px"); the flick threshold is ours (the spec only says
// "a fast flick"): faster than 0.5 px/ms in the drag's direction, strictly.
// Assumptions (flagged): one step per release, so a long drag down from
// expanded lands on peek, never hidden; a hidden sheet stays hidden; a
// release whose flick contradicts its travel is left unspecified.

type SheetState = 'hidden' | 'peek' | 'expanded';
type Release = { state: SheetState; deltaY: number; velocityY: number };
type ReleaseTarget = (release: Release) => SheetState;
type Live = { restingOffset: number; deltaY: number };
type LiveOffset = (live: Live) => number;

const MODULE = 'src/lib/ui/sheet-drag.ts';
const loadReleaseTarget = () => loadExport<ReleaseTarget>(MODULE, 'releaseTarget');
const loadLiveOffset = () => loadExport<LiveOffset>(MODULE, 'liveOffset');

// A slow drag: well under the flick speed in either direction.
const SLOW = 0.1;
// A flick: well over 0.5 px/ms.
const FLICK = 1.2;
const DOWN = 1;
const UP = -1;

describe('releaseTarget', () => {
	const cases: { name: string; release: Release; want: SheetState }[] = [
		// Up from peek → expanded.
		{
			name: 'peek, slow drag up 81px expands',
			release: { state: 'peek', deltaY: 81 * UP, velocityY: SLOW * UP },
			want: 'expanded'
		},
		{
			name: 'peek, slow drag up 200px expands',
			release: { state: 'peek', deltaY: 200 * UP, velocityY: SLOW * UP },
			want: 'expanded'
		},
		{
			name: 'peek, slow drag up exactly 80px snaps back',
			release: { state: 'peek', deltaY: 80 * UP, velocityY: SLOW * UP },
			want: 'peek'
		},
		{
			name: 'peek, slow drag up 40px snaps back',
			release: { state: 'peek', deltaY: 40 * UP, velocityY: SLOW * UP },
			want: 'peek'
		},
		{
			name: 'peek, short fast flick up expands',
			release: { state: 'peek', deltaY: 20 * UP, velocityY: FLICK * UP },
			want: 'expanded'
		},
		{
			name: 'peek, short drag up at exactly 0.5 px/ms is no flick',
			release: { state: 'peek', deltaY: 20 * UP, velocityY: 0.5 * UP },
			want: 'peek'
		},
		{
			name: 'peek, short drag up at 0.6 px/ms is a flick',
			release: { state: 'peek', deltaY: 20 * UP, velocityY: 0.6 * UP },
			want: 'expanded'
		},
		{
			name: 'peek, no travel stays in peek',
			release: { state: 'peek', deltaY: 0, velocityY: 0 },
			want: 'peek'
		},
		// Down from peek → hidden.
		{
			name: 'peek, slow drag down 81px hides',
			release: { state: 'peek', deltaY: 81 * DOWN, velocityY: SLOW * DOWN },
			want: 'hidden'
		},
		{
			name: 'peek, slow drag down 250px hides',
			release: { state: 'peek', deltaY: 250 * DOWN, velocityY: SLOW * DOWN },
			want: 'hidden'
		},
		{
			name: 'peek, slow drag down exactly 80px snaps back',
			release: { state: 'peek', deltaY: 80 * DOWN, velocityY: SLOW * DOWN },
			want: 'peek'
		},
		{
			name: 'peek, short fast flick down hides',
			release: { state: 'peek', deltaY: 20 * DOWN, velocityY: FLICK * DOWN },
			want: 'hidden'
		},
		{
			name: 'peek, a release with no net travel stays in peek',
			release: { state: 'peek', deltaY: 0, velocityY: SLOW * DOWN },
			want: 'peek'
		},
		// Down from expanded → peek.
		{
			name: 'expanded, slow drag down 81px goes to peek',
			release: { state: 'expanded', deltaY: 81 * DOWN, velocityY: SLOW * DOWN },
			want: 'peek'
		},
		{
			name: 'expanded, slow drag down past the peek position still goes to peek',
			release: { state: 'expanded', deltaY: 400 * DOWN, velocityY: SLOW * DOWN },
			want: 'peek'
		},
		{
			name: 'expanded, a fast flick down from far goes to peek, not hidden',
			release: { state: 'expanded', deltaY: 400 * DOWN, velocityY: FLICK * DOWN },
			want: 'peek'
		},
		{
			name: 'expanded, slow drag down exactly 80px snaps back',
			release: { state: 'expanded', deltaY: 80 * DOWN, velocityY: SLOW * DOWN },
			want: 'expanded'
		},
		{
			name: 'expanded, short fast flick down goes to peek',
			release: { state: 'expanded', deltaY: 20 * DOWN, velocityY: FLICK * DOWN },
			want: 'peek'
		},
		// Up from expanded: nothing above it.
		{
			name: 'expanded, slow drag up 200px stays expanded',
			release: { state: 'expanded', deltaY: 200 * UP, velocityY: SLOW * UP },
			want: 'expanded'
		},
		{
			name: 'expanded, fast flick up stays expanded',
			release: { state: 'expanded', deltaY: 20 * UP, velocityY: FLICK * UP },
			want: 'expanded'
		},
		// A hidden sheet can't be grabbed; nothing moves it.
		{
			name: 'hidden, drag up stays hidden',
			release: { state: 'hidden', deltaY: 200 * UP, velocityY: FLICK * UP },
			want: 'hidden'
		},
		{
			name: 'hidden, drag down stays hidden',
			release: { state: 'hidden', deltaY: 200 * DOWN, velocityY: FLICK * DOWN },
			want: 'hidden'
		}
	];

	for (const { name, release, want } of cases) {
		it(name, async () => {
			const releaseTarget = await loadReleaseTarget();
			const got = releaseTarget(release);
			expect(got, `releaseTarget(${JSON.stringify(release)}): got ${got}, want ${want}`).toBe(want);
		});
	}
});

// At 390×844: expanded rests at 0, peek at 330 (640 − 310).
const PEEK_OFFSET = 330;

describe('liveOffset', () => {
	const cases: { name: string; live: Live; want: number }[] = [
		{ name: 'no travel rests at peek', live: { restingOffset: PEEK_OFFSET, deltaY: 0 }, want: 330 },
		{
			name: 'follows the finger up from peek',
			live: { restingOffset: PEEK_OFFSET, deltaY: -100 },
			want: 230
		},
		{
			name: 'follows the finger down from peek',
			live: { restingOffset: PEEK_OFFSET, deltaY: 100 },
			want: 430
		},
		{
			name: 'reaches the expanded position exactly',
			live: { restingOffset: PEEK_OFFSET, deltaY: -PEEK_OFFSET },
			want: 0
		},
		{
			name: 'stops at the expanded position when dragged further up from peek',
			live: { restingOffset: PEEK_OFFSET, deltaY: -500 },
			want: 0
		},
		{
			name: 'stops at the expanded position when dragged up from expanded',
			live: { restingOffset: 0, deltaY: -60 },
			want: 0
		},
		{
			name: 'follows the finger down from expanded past the peek position',
			live: { restingOffset: 0, deltaY: 400 },
			want: 400
		},
		{
			name: 'follows the finger down far below the screen',
			live: { restingOffset: PEEK_OFFSET, deltaY: 900 },
			want: 1230
		}
	];

	for (const { name, live, want } of cases) {
		it(name, async () => {
			const liveOffset = await loadLiveOffset();
			const got = liveOffset(live);
			expect(got, `liveOffset(${JSON.stringify(live)}): got ${got}, want ${want}`).toBeCloseTo(
				want,
				6
			);
		});
	}
});
