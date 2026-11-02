import { isPrimaryPress, PointerPress } from './pointer-press.ts';
import { recentSamples, releaseVelocity, type Sample } from './pointer-velocity.ts';
import type { SheetState } from './sheet.ts';
import { liveOffset, releaseTarget } from './sheet-drag.ts';

// Dragging the mobile sheet (FE-9 FB-2, D-FE9-1, and FB-5's scroll-to-
// expand): a press on a drag zone (the handle, or content marked
// data-sheet-drag such as the header) that travels past the slop moves the
// sheet with the pointer; on release the sheet asks for at most one step
// through the caller's state path. In peek the whole sheet is a drag zone,
// so a swipe on the content moves the sheet instead of scrolling it.

const SHEET_DRAG_ZONE = '[data-sheet-drag]';

type Options = {
	state: () => SheetState;
	// Where the sheet is drawn: the state, except while a hidden sheet still
	// fades out where it rests (reduced motion).
	place: () => SheetState;
	// What the sheet shows (e.g. a region's key): new content is a new sheet.
	contentKey: () => unknown;
	// Asks for a new state exactly like a handle tap or the scrim.
	request: (next: SheetState) => void;
};

type Press = { restingOffset: number; startY: number; samples: Sample[] };
// A released offset the sheet stays at while its hide is pending (the
// screens close by a navigation, which lands later) and while it fades out
// (reduced motion), so it never slides back first. Only for that request,
// at the place and content it was released at: a newer state (a reopen) or
// other content drops it. Peek and expanded are local and applied at once,
// and a screen may refuse them: those aren't held.
type Held = { offset: number; from: SheetState; state: SheetState; key: unknown };
type Now = { state: SheetState; place: SheetState; key: unknown };

function stillHeld(held: Held, now: Now): boolean {
	if (now.key !== held.key || now.place !== held.from) return false;
	return now.state === held.state || now.state === 'hidden';
}

const sampleOf = (event: PointerEvent): Sample => ({
	time: event.timeStamp,
	position: event.clientY
});

// The sheet's translateY right now (mid-transition included), in px.
function currentOffset(sheet: Element): number {
	const transform = getComputedStyle(sheet).transform;
	return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
}

export class SheetDrag {
	#live = $state<number | undefined>(undefined);
	#held = $state.raw<Held | undefined>(undefined);
	#press: Press | undefined;
	readonly #pointer = new PointerPress('y');
	readonly #options: Options;

	constructor(options: Options) {
		this.#options = options;
	}

	// Whether the sheet follows the pointer right now (no transition).
	get dragging(): boolean {
		return this.#live !== undefined;
	}

	// The sheet's translateY while dragged or held after a release, else
	// undefined (its state's resting place).
	get offset(): number | undefined {
		if (this.#live !== undefined) return this.#live;
		const held = this.#held;
		return held !== undefined && stillHeld(held, this.#now()) ? held.offset : undefined;
	}

	// Call whenever the state, place or content changes: follows the held
	// request into hidden, and drops the hold for anything else.
	settleHeld() {
		const held = this.#held;
		if (held === undefined) return;
		const now = this.#now();
		if (!stillHeld(held, now)) this.#held = undefined;
		else if (held.state !== now.state) this.#held = { ...held, state: now.state };
	}

	#now(): Now {
		const { state, place, contentKey } = this.#options;
		return { state: state(), place: place(), key: contentKey() };
	}

	start = (event: PointerEvent) => {
		if (!isPrimaryPress(event) || !this.#grabs(event.target)) return;
		this.#pointer.begin(event);
		this.#press = {
			restingOffset: currentOffset(event.currentTarget as Element),
			startY: event.clientY,
			samples: [sampleOf(event)]
		};
	};

	move = (event: PointerEvent) => {
		const press = this.#press;
		const deltaY = this.#pointer.travel(event);
		if (!this.#pointer.pressed) this.#live = undefined;
		if (press === undefined || deltaY === undefined) return;
		this.#held = undefined;
		press.samples = recentSamples([...press.samples, sampleOf(event)], event.timeStamp);
		this.#live = liveOffset({ restingOffset: press.restingOffset, deltaY });
	};

	end = (event: PointerEvent) => {
		const press = this.#press;
		const live = this.#live;
		const deltaY = this.#pointer.release(event);
		if (this.#pointer.pressed) return;
		this.#live = undefined;
		if (press === undefined || deltaY === undefined || live === undefined) return;
		const state = this.#options.state();
		const velocityY = releaseVelocity(press.samples, event.timeStamp);
		const next = releaseTarget({ state, deltaY, velocityY });
		if (next === state) return;
		if (next === 'hidden') this.#hold(live);
		this.#options.request(next);
	};

	cancel = (event: PointerEvent) => {
		if (this.#pointer.cancel(event)) this.#live = undefined;
	};

	clickAfterDrag = (event: MouseEvent) => this.#pointer.clickAfterDrag(event);

	// A press in a drag zone never starts the browser's own drag of a link
	// or an image there (it would cancel the pointer).
	preventNativeDrag = (event: DragEvent) => {
		if (this.#grabs(event.target)) event.preventDefault();
	};

	#hold(offset: number) {
		const now = this.#now();
		this.#held = { offset, from: now.place, state: now.state, key: now.key };
	}

	#grabs(target: EventTarget | null): boolean {
		const state = this.#options.state();
		if (state === 'peek') return true;
		return state === 'expanded' && target instanceof Element && !!target.closest(SHEET_DRAG_ZONE);
	}
}
