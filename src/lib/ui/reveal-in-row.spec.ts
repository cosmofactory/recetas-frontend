import { describe, expect, it } from 'vitest';
import { nearestScrollDelta, type Span } from './reveal-in-row.ts';

// Item 5 of the region-map review: a deep link's active region chip is
// scrolled into its row, inline nearest (the scrollIntoView rule).
describe('nearestScrollDelta', () => {
	const view: Span = { left: 0, right: 100 };
	const cases: { name: string; item: Span; want: number }[] = [
		{ name: 'an item fully in view stays', item: { left: 10, right: 60 }, want: 0 },
		{
			name: 'an item past the end scrolls by its overhang',
			item: { left: 90, right: 130 },
			want: 30
		},
		{ name: 'an item before the start scrolls back', item: { left: -25, right: 15 }, want: -25 },
		{
			name: 'an item wider than the view aligns its start',
			item: { left: 50, right: 200 },
			want: 50
		}
	];
	for (const tc of cases) {
		it(tc.name, () => {
			expect(nearestScrollDelta(view, tc.item)).toBe(tc.want);
		});
	}
});
