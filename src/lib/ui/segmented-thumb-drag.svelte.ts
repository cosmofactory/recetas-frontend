import { dragThumbOffset, snapIndex, type Geometry } from './segmented-drag.ts';

// Dragging the segmented switch's thumb (FE-9 FB-3, D-FE9-2): a press on the
// active segment that travels past DRAG_SLOP_PX follows the pointer; on
// release the thumb snaps to the nearer segment, and a different segment is
// selected through the caller's tap path. Shorter travel is a plain tap.

// Under this travel a press is still a tap (finger jitter).
const DRAG_SLOP_PX = 4;
// PointerEvent.button of a left mouse button, a touch or a pen tip.
const PRIMARY_BUTTON = 0;

type Options = {
	tabs: () => HTMLElement[];
	selectedIndex: () => number;
	// Selects a segment exactly like a tap on it.
	choose: (index: number) => void;
};

type Press = { pointerId: number; startX: number; fromIndex: number; geometry: Geometry };
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
	#swallowClick = false;
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
		if (!event.isPrimary || event.button !== PRIMARY_BUTTON) return;
		const tabs = this.#options.tabs();
		const index = tabs.findIndex((tab) => tab.contains(event.target as Node));
		const geometry = measure(tabs);
		if (index !== this.#options.selectedIndex() || geometry === undefined) return;
		this.#press = { pointerId: event.pointerId, startX: event.clientX, fromIndex: index, geometry };
	};

	move = (event: PointerEvent) => {
		const press = this.#press;
		if (press?.pointerId !== event.pointerId) return;
		const deltaX = event.clientX - press.startX;
		if (this.offset === undefined && Math.abs(deltaX) < DRAG_SLOP_PX) return;
		if (this.offset === undefined) {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		}
		this.offset = dragThumbOffset(press.geometry, { fromIndex: press.fromIndex, deltaX });
	};

	end = (event: PointerEvent) => {
		const press = this.#press;
		const offset = this.offset;
		if (press?.pointerId !== event.pointerId) return;
		this.#press = undefined;
		this.offset = undefined;
		if (offset === undefined) return;
		this.#swallowRelease();
		const index = snapIndex(press.geometry, offset);
		if (index === press.fromIndex) return;
		this.#held = { index, from: press.fromIndex };
		this.#options.choose(index);
	};

	cancel = (event: PointerEvent) => {
		if (this.#press?.pointerId !== event.pointerId) return;
		this.#press = undefined;
		this.offset = undefined;
	};

	// The release's own click (mouse, pen) comes in the same input task; a
	// moved touch fires none, so the swallow ends with the task either way.
	#swallowRelease() {
		this.#swallowClick = true;
		setTimeout(() => (this.#swallowClick = false), 0);
	}

	// Capture phase, so neither the tab nor the router sees the click. A
	// synthetic click is the drag's own selection; a keyboard one (detail 0)
	// is a new activation.
	clickAfterDrag = (event: MouseEvent) => {
		if (!event.isTrusted) return;
		const swallow = this.#swallowClick && event.detail > 0;
		this.#swallowClick = false;
		if (!swallow) return;
		event.preventDefault();
		event.stopPropagation();
	};
}
