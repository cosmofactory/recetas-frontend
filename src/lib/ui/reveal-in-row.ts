// Scrolls a horizontal scroller just enough to show one of its items, like
// scrollIntoView({ inline: 'nearest' }) but without moving any outer
// scroller (the home map scroller) and never smoothly.

export type Span = { left: number; right: number };

// How far the view must scroll (negative: back) to contain the item; an item
// wider than the view is aligned at its start.
export function nearestScrollDelta(view: Span, item: Span): number {
	if (item.left < view.left) return item.left - view.left;
	if (item.right <= view.right) return 0;
	return Math.min(item.right - view.right, item.left - view.left);
}

export function revealInRow(row: HTMLElement, item: HTMLElement) {
	const delta = nearestScrollDelta(row.getBoundingClientRect(), item.getBoundingClientRect());
	if (delta !== 0) row.scrollLeft += delta;
}
