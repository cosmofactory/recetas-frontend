// Mobile README -> Regional tab -> Region sheet: the 2a sheet's states, what
// the handle toggles and how far the scrim dims. Both READMEs ->
// Accessibility: only the expanded sheet traps focus.
export type SheetState = 'hidden' | 'peek' | 'expanded';

const SCRIM_OPACITY: Record<SheetState, number> = { hidden: 0, peek: 0.18, expanded: 0.45 };

// The handle can't be reached while hidden, so a toggle there changes nothing.
export function toggledSheetState(state: SheetState): SheetState {
	if (state === 'peek') return 'expanded';
	if (state === 'expanded') return 'peek';
	return state;
}

export function sheetScrimOpacity(state: SheetState): number {
	return SCRIM_OPACITY[state];
}

export function isSheetModal(state: SheetState): boolean {
	return state === 'expanded';
}

// A sheet whose content comes from the URL (a region, a dish): open, it
// rests in peek and the handle's local `expanded` raises it; closed, hidden.
export function urlSheetState(open: boolean, expanded: boolean): SheetState {
	if (!open) return 'hidden';
	return expanded ? 'expanded' : 'peek';
}
