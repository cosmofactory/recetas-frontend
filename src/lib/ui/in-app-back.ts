import { afterNavigate } from '$app/navigation';
import { originTab, recordOrigin, type BackOrigin } from './back-origin.ts';
import { entrySnapshot } from './entry-snapshot.ts';
import { isPlainClick } from './plain-click.ts';

// The home tab the page last entered showed, so a push from Variations
// carries its tab over to the Recipe (only one such page is mounted at a time).
let shownTab = originTab(null);

// Stage FE-6 -> Small decisions: a back link keeps its href (the direct-entry
// fallback, and what works without JavaScript); once hydrated, when the
// previous history entry is a shallower page of this app (going back is
// going up the route stack), a plain click goes back in history instead, so
// that page returns with its exact URL and state. Only a forward push
// (pageDirection) records one; the first page loaded and a link or goto from
// a deeper or same-depth page record none. It belongs to the history entry, so history
// traversal restores what the entry had (direct entry → Recipe → Back: none).
// onOrigin hears the entry's origin (recordOrigin) whenever it is recorded or
// restored, for the desktop back pill and top bar.
export function inAppBack(
	id: string,
	onOrigin?: (origin: BackOrigin | null) => void
): (event: MouseEvent) => void {
	let origin: BackOrigin | null = null;
	const update = (next: BackOrigin | null) => {
		origin = next;
		shownTab = originTab(next);
		onOrigin?.(next);
	};

	entrySnapshot({ id, capture: () => origin, restore: update });
	afterNavigate((navigation) => {
		if (navigation.type !== 'popstate') update(recordOrigin(navigation, shownTab));
	});

	return (event) => {
		if (!origin || !isPlainClick(event)) return;
		event.preventDefault();
		history.back();
	};
}
