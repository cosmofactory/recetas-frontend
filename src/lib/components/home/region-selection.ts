import type { SheetState } from '#lib/ui/sheet.ts';

// Desktop README -> Regional: "Andalucía is selected on first load". Stage
// FE-4: only when the URL has no region, and never written into the URL.
export const DEFAULT_DESKTOP_REGION_KEY = 'and';

export function findRegion<R extends { key: string }>(
	regions: readonly R[],
	key: string | undefined
): R | undefined {
	return key === undefined ? undefined : regions.find((region) => region.key === key);
}

// The URL's region; on desktop the default stands in for none.
export function shownRegionKey(urlKey: string | undefined, desktop: boolean): string | undefined {
	return urlKey ?? (desktop ? DEFAULT_DESKTOP_REGION_KEY : undefined);
}

// The mobile region sheet follows the URL: a region opens it in peek, the
// handle's local `expanded` raises it, and no region (or desktop, where the
// panel shows it) hides it.
export function regionSheetState(open: boolean, expanded: boolean): SheetState {
	if (!open) return 'hidden';
	return expanded ? 'expanded' : 'peek';
}
