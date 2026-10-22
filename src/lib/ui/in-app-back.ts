import { afterNavigate } from '$app/navigation';
import { entrySnapshot } from './entry-snapshot.ts';
import { pageDirection } from './page-push.ts';
import { isPlainClick } from './plain-click.ts';

// Stage FE-6 -> Small decisions: a back link keeps its href (the direct-entry
// fallback, and what works without JavaScript); once hydrated, when the
// previous history entry is a shallower page of this app (going back is
// going up the route stack), a plain click goes back in history instead, so
// that page returns with its exact URL and state. Only a forward push
// (pageDirection) records one; the first page loaded and a link or goto from
// a deeper or same-depth page record none. It belongs to the history entry, so history
// traversal restores what the entry had (direct entry → Recipe → Back: none).
export function inAppBack(id: string): (event: MouseEvent) => void {
	let previousIsInApp = false;

	entrySnapshot({ id, capture: () => previousIsInApp, restore: (v) => (previousIsInApp = v) });
	afterNavigate((navigation) => {
		if (navigation.type !== 'popstate') previousIsInApp = pageDirection(navigation) === 'push';
	});

	return (event) => {
		if (!previousIsInApp || !isPlainClick(event)) return;
		event.preventDefault();
		history.back();
	};
}
