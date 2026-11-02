import { isPrimaryPress, PointerPress } from './pointer-press.ts';
import { dragThumbOffset, snapIndex, type Geometry } from './segmented-drag.ts';

// Dragging the segmented switch's thumb (FE-9 FB-3, D-FE9-2): a press on the
// active segment that travels past the slop follows the pointer; on
// release the thumb snaps to the nearer segment, and a different segment is
// selected through the caller's tap path. Shorter travel is a plain tap.

type Options = {
	tabs: () => HTMLElement[];
	selectedIndex: () => number;
	// Selects a segment exactly like a tap on it.
	choose: (index: number) => void;
};

type Press = { fromIndex: number; geometry: Geometry };
// A drag-chosen segment the thumb rests on until the selection catches up
// (a link tab selects only once its navigation lands).
type Held = { index: number; from: number };

function measure(tabs: HTMLElement[]): Geometry | undefined {
	if (tabs.length === 0) return undefined;
	const first = tabs[0].getBoundingClientRect();
	const gap = tabs.length > 1 ? tabs[1].getBoundingClientRect().left - first.right : 0;
	return { segmentWidth: first.width, gap, count: tabs.length };
}

export class ThumbDrag {
	// The thumb's offset from the first segment while dragging, else undefined.
	offset = $state<number | undefined>(undefined);
	#held = $state<Held | undefined>(undefined);
	#press: Press | undefined;
	readonly #pointer = new PointerPress('x');
	readonly #options: Options;

	constructor(options: Options) {
		this.#options = options;
	}

	restingIndex(selectedIndex: number): number {
		return this.#held?.from === selectedIndex ? this.#held.index : selectedIndex;
	}

	forgetHeld(selectedIndex: number) {
		if (this.#held !== undefined && this.#held.from !== selectedIndex) this.#held = undefined;
	}

	// The held segment stays until the selection moves (forgetHeld), so a
	// press while a drag-select navigates doesn't send the thumb back.
	start = (event: PointerEvent) => {
		if (!isPrimaryPress(event)) return;
		const tabs = this.#options.tabs();
		const index = tabs.findIndex((tab) => tab.contains(event.target as Node));
		const geometry = measure(tabs);
		if (index !== this.#options.selectedIndex() || geometry === undefined) return;
		this.#pointer.begin(event);
		this.#press = { fromIndex: index, geometry };
	};

	move = (event: PointerEvent) => {
		const press = this.#press;
		const deltaX = this.#pointer.travel(event);
		if (!this.#pointer.pressed) this.offset = undefined;
		if (press === undefined || deltaX === undefined) return;
		this.offset = dragThumbOffset(press.geometry, { fromIndex: press.fromIndex, deltaX });
	};

	end = (event: PointerEvent) => {
		const press = this.#press;
		const offset = this.offset;
		const deltaX = this.#pointer.release(event);
		if (this.#pointer.pressed) return;
		this.offset = undefined;
		if (press === undefined || deltaX === undefined || offset === undefined) return;
		const index = snapIndex(press.geometry, offset);
		if (index === press.fromIndex) return;
		this.#held = { index, from: press.fromIndex };
		this.#options.choose(index);
	};

	cancel = (event: PointerEvent) => {
		if (!this.#pointer.cancel(event)) return;
		this.offset = undefined;
	};

	clickAfterDrag = (event: MouseEvent) => this.#pointer.clickAfterDrag(event);
}
