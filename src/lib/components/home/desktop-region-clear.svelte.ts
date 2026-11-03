import { pushEscapeLayer } from '#lib/ui/escape-layers.ts';
import { isPlainClick } from '#lib/ui/plain-click.ts';

type DesktopRegionClearOptions = {
	// The region the desktop panel shows; none on the bare home and below
	// 860px, where the sheet's scrim and Escape close it instead.
	selectedKey: () => string | undefined;
	// Leaves the region: the same navigation as the mobile sheet's close.
	onClear: () => void;
	// The panel, whose content the clear replaces.
	panel: () => HTMLElement | undefined;
	// The map link of a region, where focus goes from the panel.
	regionLink: (key: string) => HTMLElement | undefined;
};

// D-FE9-8: on desktop, a plain click on the selected region again, or
// Escape (the lowest escape layer, like a sheet), clears the selection.
// Escape from inside the panel first moves focus to the region's map link,
// so it isn't lost with the panel's content (WCAG 2.4.3). Call during
// component init; the returned handler reports whether it took the click over.
export function desktopRegionClear(options: DesktopRegionClearOptions) {
	const selected = $derived(options.selectedKey());

	$effect(() => {
		const key = selected;
		if (key === undefined) return;
		return pushEscapeLayer('sheet', () => {
			focusMapLinkFromPanel(options, key);
			options.onClear();
		});
	});

	return (key: string, event: MouseEvent): boolean => {
		if (key !== selected || !isPlainClick(event)) return false;
		event.preventDefault();
		options.onClear();
		return true;
	};
}

function focusMapLinkFromPanel(options: DesktopRegionClearOptions, key: string) {
	if (!options.panel()?.contains(document.activeElement)) return;
	options.regionLink(key)?.focus();
}
