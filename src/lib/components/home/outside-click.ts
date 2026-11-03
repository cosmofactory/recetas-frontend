import { isPlainClick } from '#lib/ui/plain-click.ts';

type ClickLike = Pick<
	MouseEvent,
	'target' | 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
>;

type ClickAreas = {
	// The region panel: a click on it, even on its padding, keeps the region.
	panel: Element | undefined;
	topBar: Element | undefined;
};

// D-FE9-9: a click on or inside any of these does its own thing, never a clear.
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="tab"]';

// Whether a click lands on empty space (the map's gaps and sea, the page
// background, the about block) and so clears the desktop region.
export function isClearingClick(event: ClickLike, areas: ClickAreas): boolean {
	const target = event.target;
	if (!(target instanceof Element) || !target.isConnected) return false;
	if (event.defaultPrevented || !isPlainClick(event)) return false;
	if (areas.panel?.contains(target) || areas.topBar?.contains(target)) return false;
	return target.closest(INTERACTIVE) === null;
}
