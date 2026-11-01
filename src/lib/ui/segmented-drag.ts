// Dragging the segmented switch's thumb (FE-9 FB-3, D-FE9-2). Segments are
// equal (flex: 1) and `gap` apart, so segment i sits at i × pitch from the
// first segment's left edge; offsets are measured from that edge.

export type Geometry = { segmentWidth: number; gap: number; count: number };
export type Drag = { fromIndex: number; deltaX: number };

function pitch(geometry: Geometry): number {
	return geometry.segmentWidth + geometry.gap;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function lastIndex(geometry: Geometry): number {
	return Math.max(geometry.count - 1, 0);
}

// Where the thumb is while the pointer is down: the grabbed segment's offset
// plus the pointer's travel, kept on the track.
export function dragThumbOffset(geometry: Geometry, drag: Drag): number {
	const offset = drag.fromIndex * pitch(geometry) + drag.deltaX;
	return clamp(offset, 0, lastIndex(geometry) * pitch(geometry));
}

// The segment the thumb is nearest to on release.
export function snapIndex(geometry: Geometry, offset: number): number {
	const step = pitch(geometry);
	if (step <= 0) return 0;
	return clamp(Math.round(offset / step), 0, lastIndex(geometry));
}
