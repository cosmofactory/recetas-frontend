import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-3 StickyTopBar logic (src/lib/ui/scroll-threshold.ts, pure). Mobile
// README -> Screen 2: the title fades in and the hairline appears "once
// scrolled past 230px" (Recipe page: "after 280px"). The prototypes compare
// strictly: `el.scrollTop > 230` (DishVariations.dc.html), `> 280`
// (Recipe.dc.html), so exactly at the threshold is not past it. A negative
// scroll position (rubber-band overscroll on iOS) is not past either.

type IsPastThreshold = (scrollY: number, threshold: number) => boolean;
const MODULE = 'src/lib/ui/scroll-threshold.ts';

const cases: { scrollY: number; threshold: number; want: boolean }[] = [
	{ scrollY: 0, threshold: 230, want: false },
	{ scrollY: 229, threshold: 230, want: false },
	{ scrollY: 230, threshold: 230, want: false },
	{ scrollY: 230.5, threshold: 230, want: true },
	{ scrollY: 231, threshold: 230, want: true },
	{ scrollY: 5000, threshold: 230, want: true },
	{ scrollY: 280, threshold: 280, want: false },
	{ scrollY: 281, threshold: 280, want: true },
	{ scrollY: 250, threshold: 280, want: false },
	{ scrollY: -40, threshold: 230, want: false },
	{ scrollY: 1, threshold: 0, want: true },
	{ scrollY: 0, threshold: 0, want: false }
];

describe('isPastThreshold', () => {
	for (const { scrollY, threshold, want } of cases) {
		it(`is ${want} at scrollY ${scrollY} with threshold ${threshold}`, async () => {
			const isPast = await loadExport<IsPastThreshold>(MODULE, 'isPastThreshold');
			const got = isPast(scrollY, threshold);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}
});
