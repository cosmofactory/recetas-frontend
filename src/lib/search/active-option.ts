// The combobox's active option (stage FE-7 -> Small decisions): an index
// into the results in display order, NO_ACTIVE_OPTION while none is. The
// arrow keys stop at either end; they never wrap.
export const NO_ACTIVE_OPTION = -1;

const STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

// The active index after `key`, or undefined when the key doesn't move it.
export function movedActiveOption(key: string, active: number, count: number): number | undefined {
	const step = STEP[key];
	if (step === undefined) return undefined;
	const next = active + step;
	if (next < 0 || next >= count) return active;
	return next;
}
