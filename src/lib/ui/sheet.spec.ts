import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-3 BottomSheet logic, kept out of the component (src/lib/ui/sheet.ts).
// Mobile README -> Regional tab -> Region sheet:
// - "States: hidden (translateY 680px), peek (...330px), expanded (translateY 0)."
// - "Tapping the handle area toggles peek ↔ expanded."
// - "Scrim behind the sheet: `--scrim`, opacity 0.18 at peek, 0.45 expanded".
// Both READMEs -> Accessibility: "Sheets: focus-trap when expanded" — only
// the expanded sheet is modal.

type SheetState = 'hidden' | 'peek' | 'expanded';
const MODULE = 'src/lib/ui/sheet.ts';

describe('toggledSheetState (the handle)', () => {
	const cases: { from: SheetState; want: SheetState }[] = [
		{ from: 'peek', want: 'expanded' },
		{ from: 'expanded', want: 'peek' },
		// The handle can't be reached while hidden; a toggle there changes nothing.
		{ from: 'hidden', want: 'hidden' }
	];
	for (const { from, want } of cases) {
		it(`goes from ${from} to ${want}`, async () => {
			const toggled = await loadExport<(s: SheetState) => SheetState>(MODULE, 'toggledSheetState');
			expect(toggled(from)).toBe(want);
		});
	}
});

describe('sheetScrimOpacity', () => {
	const cases: { state: SheetState; want: number }[] = [
		{ state: 'hidden', want: 0 },
		{ state: 'peek', want: 0.18 },
		{ state: 'expanded', want: 0.45 }
	];
	for (const { state, want } of cases) {
		it(`is ${want} when the sheet is ${state}`, async () => {
			const opacity = await loadExport<(s: SheetState) => number>(MODULE, 'sheetScrimOpacity');
			expect(opacity(state)).toBe(want);
		});
	}
});

describe('isSheetModal', () => {
	const cases: { state: SheetState; want: boolean }[] = [
		{ state: 'hidden', want: false },
		{ state: 'peek', want: false },
		{ state: 'expanded', want: true }
	];
	for (const { state, want } of cases) {
		it(`is ${want} when the sheet is ${state}`, async () => {
			const isModal = await loadExport<(s: SheetState) => boolean>(MODULE, 'isSheetModal');
			expect(isModal(state)).toBe(want);
		});
	}
});
