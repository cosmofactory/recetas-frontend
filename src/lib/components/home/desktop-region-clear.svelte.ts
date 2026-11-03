import { isLayerShownAbove, pushEscapeLayer } from '#lib/ui/escape-layers.ts';
import { isPlainClick } from '#lib/ui/plain-click.ts';
import { isClearingClick } from './outside-click.ts';

type DesktopRegionClearOptions = {
	// The region the desktop panel shows; none on the bare home and below
	// 860px, where the sheet's scrim and Escape close it instead.
	selectedKey: () => string | undefined;
	// Leaves the region: the same navigation as the mobile sheet's close.
	onClear: () => void;
	// The panel, whose content the clear replaces.
	panel: () => HTMLElement | undefined;
	// The desktop top bar, where a click never clears.
	topBar: () => HTMLElement | undefined;
	// The map link of a region, where focus goes from the panel.
	regionLink: (key: string) => HTMLElement | undefined;
};

// D-FE9-8: on desktop, a plain click on the selected region again, or
// Escape (the lowest escape layer, like a sheet), clears the selection.
// Escape from inside the panel first moves focus to the region's map link,
// so it isn't lost with the panel's content (WCAG 2.4.3). D-FE9-9: so does
// a plain click on empty space (`isClearingClick`), without moving focus.
// Call during component init; the returned handler reports whether it took
// the click over.
export function desktopRegionClear(options: DesktopRegionClearOptions) {
	const selected = $derived(options.selectedKey());

	$effect(() => {
		const key = selected;
		if (key === undefined) return;
		const removeLayer = pushEscapeLayer('sheet', () => {
			focusMapLinkFromPanel(options, key);
			options.onClear();
		});
		const stopListening = clearOnOutsideClick(options);
		return () => {
			removeLayer();
			stopListening();
		};
	});

	return (key: string, event: MouseEvent): boolean => {
		if (key !== selected || !isPlainClick(event)) return false;
		event.preventDefault();
		options.onClear();
		return true;
	};
}

// A clear needs both the press and the click on empty space, so a drag
// (selecting text from the panel out onto the map, or inside the about
// paragraph) never clears. An open search dropdown or language menu closes
// on the press itself, so whether one was open is read when the press starts
// (capture phase, before their own listeners): that click only closes the
// overlay, like Escape.
function clearOnOutsideClick(options: DesktopRegionClearOptions): () => void {
	let pressCouldClear = false;
	const areas = () => ({ panel: options.panel(), topBar: options.topBar() });
	const onPointerDown = (event: PointerEvent) => {
		pressCouldClear = !isLayerShownAbove('sheet') && isClearingClick(event, areas());
	};
	const onClick = (event: MouseEvent) => {
		if (!pressCouldClear || !isSelectionCollapsed()) return;
		if (isClearingClick(event, areas())) options.onClear();
	};
	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('click', onClick);
	return () => {
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('click', onClick);
	};
}

// A click that ends a text selection is a selection, not a clear.
const isSelectionCollapsed = () => document.getSelection()?.isCollapsed !== false;

function focusMapLinkFromPanel(options: DesktopRegionClearOptions, key: string) {
	if (!options.panel()?.contains(document.activeElement)) return;
	options.regionLink(key)?.focus();
}
