import { entrySnapshot } from './entry-snapshot.ts';

type ScrollOffset = { top: number; left: number };

// D-FE6-1: a scroller's offset (the mobile Popular list, the filter bar)
// belongs to its history entry, so Back from the Variations page returns to
// it. Call during component init.
export function scrollSnapshot(id: string, scroller: () => HTMLElement | undefined): void {
	entrySnapshot<ScrollOffset | null>({
		id,
		capture: () => {
			const el = scroller();
			return el ? { top: el.scrollTop, left: el.scrollLeft } : null;
		},
		restore: (offset) => {
			if (offset) scroller()?.scrollTo(offset);
		}
	});
}
