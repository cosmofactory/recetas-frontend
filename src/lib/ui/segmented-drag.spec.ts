import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-9 FB-3, spec addition D-FE9-2: the Regional | Popular switch has one
// thumb that "can be dragged along the track; on release it snaps to the
// nearer segment and selects it". The pure math lives in
// src/lib/ui/segmented-drag.ts:
// - dragThumbOffset(geometry, { fromIndex, deltaX }): where the thumb is
//   while the pointer is down, as an offset from the first segment's left
//   edge: the grabbed segment's offset plus the pointer's travel, clamped to
//   the track (first segment .. last segment).
// - snapIndex(geometry, offset): the segment the thumb is nearest to on
//   release (its left edge nearest that segment's left edge, i.e. its centre
//   nearest that segment's centre), clamped to a real segment.
// Segments are equal (flex: 1) and `gap` apart, so segment i sits at
// i × (segmentWidth + gap).

type Geometry = { segmentWidth: number; gap: number; count: number };
type Drag = { fromIndex: number; deltaX: number };
type DragThumbOffset = (geometry: Geometry, drag: Drag) => number;
type SnapIndex = (geometry: Geometry, offset: number) => number;

const MODULE = 'src/lib/ui/segmented-drag.ts';
const loadDragOffset = () => loadExport<DragThumbOffset>(MODULE, 'dragThumbOffset');
const loadSnapIndex = () => loadExport<SnapIndex>(MODULE, 'snapIndex');

// The mobile header at 390px: a 350px track, padding 4px, gap 4px, so two
// 169px segments; Popular sits 173px right of Regional.
const MOBILE: Geometry = { segmentWidth: 169, gap: 4, count: 2 };
const MOBILE_PITCH = 173;
// Three round segments, to tell "the other one" from "the nearest one".
const THREE: Geometry = { segmentWidth: 96, gap: 4, count: 3 };
const THREE_PITCH = 100;

describe('dragThumbOffset', () => {
	const cases: { name: string; geometry: Geometry; drag: Drag; want: number }[] = [
		{
			name: 'no travel rests on the first segment',
			geometry: MOBILE,
			drag: { fromIndex: 0, deltaX: 0 },
			want: 0
		},
		{
			name: 'no travel rests on the grabbed second segment',
			geometry: MOBILE,
			drag: { fromIndex: 1, deltaX: 0 },
			want: MOBILE_PITCH
		},
		{
			name: 'follows the pointer right from the first segment',
			geometry: MOBILE,
			drag: { fromIndex: 0, deltaX: 50 },
			want: 50
		},
		{
			name: 'follows the pointer left from the second segment',
			geometry: MOBILE,
			drag: { fromIndex: 1, deltaX: -50 },
			want: MOBILE_PITCH - 50
		},
		{
			name: 'reaches the last segment exactly',
			geometry: MOBILE,
			drag: { fromIndex: 0, deltaX: MOBILE_PITCH },
			want: MOBILE_PITCH
		},
		{
			name: 'stops at the last segment past the track end',
			geometry: MOBILE,
			drag: { fromIndex: 0, deltaX: 400 },
			want: MOBILE_PITCH
		},
		{
			name: 'stops at the last segment when pushed further right',
			geometry: MOBILE,
			drag: { fromIndex: 1, deltaX: 20 },
			want: MOBILE_PITCH
		},
		{
			name: 'stops at the first segment when pushed left',
			geometry: MOBILE,
			drag: { fromIndex: 0, deltaX: -30 },
			want: 0
		},
		{
			name: 'stops at the first segment past the track start',
			geometry: MOBILE,
			drag: { fromIndex: 1, deltaX: -500 },
			want: 0
		},
		{
			name: 'three segments: grabbing the middle starts at its offset',
			geometry: THREE,
			drag: { fromIndex: 1, deltaX: 0 },
			want: THREE_PITCH
		},
		{
			name: 'three segments: travel adds to the middle offset',
			geometry: THREE,
			drag: { fromIndex: 1, deltaX: 37 },
			want: THREE_PITCH + 37
		},
		{
			name: 'three segments: clamps at the third segment',
			geometry: THREE,
			drag: { fromIndex: 1, deltaX: 999 },
			want: 2 * THREE_PITCH
		}
	];
	for (const { name, geometry, drag, want } of cases) {
		it(name, async () => {
			const dragThumbOffset = await loadDragOffset();
			const got = dragThumbOffset(geometry, drag);
			expect(got, `got offset ${got}, want ${want}`).toBeCloseTo(want, 6);
		});
	}
});

describe('snapIndex', () => {
	const cases: { name: string; geometry: Geometry; offset: number; want: number }[] = [
		{ name: 'at rest on the first segment', geometry: MOBILE, offset: 0, want: 0 },
		{ name: 'at rest on the second segment', geometry: MOBILE, offset: MOBILE_PITCH, want: 1 },
		{ name: 'a small drag snaps back to the first segment', geometry: MOBILE, offset: 20, want: 0 },
		{
			name: 'just short of halfway stays on the first segment',
			geometry: MOBILE,
			offset: 86,
			want: 0
		},
		{
			name: 'just past halfway snaps to the second segment',
			geometry: MOBILE,
			offset: 87,
			want: 1
		},
		{
			name: 'a small drag back from the second segment keeps it',
			geometry: MOBILE,
			offset: MOBILE_PITCH - 20,
			want: 1
		},
		{
			name: 'an offset before the track clamps to the first segment',
			geometry: MOBILE,
			offset: -40,
			want: 0
		},
		{
			name: 'an offset past the track clamps to the last segment',
			geometry: MOBILE,
			offset: 500,
			want: 1
		},
		{
			name: 'three segments: near the middle picks the middle',
			geometry: THREE,
			offset: 149,
			want: 1
		},
		{
			name: 'three segments: past the middle-to-last halfway picks the last',
			geometry: THREE,
			offset: 151,
			want: 2
		},
		{
			name: 'three segments: just before the first halfway picks the first',
			geometry: THREE,
			offset: 49,
			want: 0
		}
	];
	for (const { name, geometry, offset, want } of cases) {
		it(name, async () => {
			const snapIndex = await loadSnapIndex();
			expect(snapIndex(geometry, offset), `offset ${offset}`).toBe(want);
		});
	}

	it('releasing wherever the drag left the thumb picks the segment under it', async () => {
		const [dragThumbOffset, snapIndex] = await Promise.all([loadDragOffset(), loadSnapIndex()]);
		const travels = [-300, -10, 0, 30, 80, 90, 120, 173, 400];
		const got = travels.map((deltaX) =>
			snapIndex(MOBILE, dragThumbOffset(MOBILE, { fromIndex: 0, deltaX }))
		);
		expect(got).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1]);
	});
});
