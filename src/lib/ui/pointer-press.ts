// The press half of a pointer drag, shared by the segmented switch's thumb
// (FE-9 FB-3) and the mobile sheet (FB-2): a primary press that the pressed
// element captures at once (so a first move or a release off it is never
// lost, and its own click still lands on it), a drag only past
// DRAG_SLOP_PX on the gesture's axis, and the drag's own click swallowed
// (and the click of a press that slides off the pressed control: the link,
// button or tab around the press, not the child it landed on).

export type Axis = 'x' | 'y';

// Under this travel a press is still a tap (finger jitter).
const DRAG_SLOP_PX = 4;
// PointerEvent.button of a left mouse button, a touch or a pen tip.
const PRIMARY_BUTTON = 0;
// PointerEvent.buttons bit of the same.
const PRIMARY_BUTTONS_BIT = 1;
// What a press activates; a release anywhere inside it is still a tap. It
// lists what the sheet and the switch render: add a new kind of control here.
const CONTROL_SELECTOR = 'a[href], button, [role="tab"]';

type Press = { control: Element; pointerId: number; x: number; y: number; dragging: boolean };

const along = (event: PointerEvent, axis: Axis) => (axis === 'x' ? event.clientX : event.clientY);

const pressedControl = (target: Element) => target.closest(CONTROL_SELECTOR) ?? target;

function releasedOn(control: Element, event: PointerEvent): boolean {
	const under = control.ownerDocument.elementFromPoint(event.clientX, event.clientY);
	return under !== null && control.contains(under);
}

export function isPrimaryPress(event: PointerEvent): boolean {
	return event.isPrimary && event.button === PRIMARY_BUTTON;
}

export class PointerPress {
	#press: Press | undefined;
	#swallowClick = false;
	readonly #axis: Axis;

	constructor(axis: Axis) {
		this.#axis = axis;
	}

	get pressed(): boolean {
		return this.#press !== undefined;
	}

	// Call only for a primary press the gesture takes.
	begin(event: PointerEvent) {
		const target = event.target as Element;
		target.setPointerCapture(event.pointerId);
		const { pointerId, clientX: x, clientY: y } = event;
		this.#press = { control: pressedControl(target), pointerId, x, y, dragging: false };
	}

	// The travel since the press once it is a drag, else undefined. A move
	// with the button up means the release was lost: the press ends.
	travel(event: PointerEvent): number | undefined {
		const press = this.#ownPress(event);
		if (press === undefined) return undefined;
		if ((event.buttons & PRIMARY_BUTTONS_BIT) === 0) {
			this.#press = undefined;
			return undefined;
		}
		const delta = this.#delta(press, event);
		if (!press.dragging && Math.abs(delta) < DRAG_SLOP_PX) return undefined;
		press.dragging = true;
		return delta;
	}

	// Ends the press: the drag's travel, or undefined for a tap or another
	// pointer. A drag's own click is swallowed, and so is the click of a
	// press released off the pressed control (a slide-off cancels, as it
	// does without capture).
	release(event: PointerEvent): number | undefined {
		const press = this.#ownPress(event);
		if (press === undefined) return undefined;
		this.#press = undefined;
		if (press.dragging || !releasedOn(press.control, event)) this.#swallowRelease();
		return press.dragging ? this.#delta(press, event) : undefined;
	}

	// Whether the cancelled pointer was this press (now dropped).
	cancel(event: PointerEvent): boolean {
		if (this.#ownPress(event) === undefined) return false;
		this.#press = undefined;
		return true;
	}

	#ownPress(event: PointerEvent): Press | undefined {
		return this.#press?.pointerId === event.pointerId ? this.#press : undefined;
	}

	#delta(press: Press, event: PointerEvent): number {
		return along(event, this.#axis) - press[this.#axis];
	}

	// The release's own click (mouse, pen) comes in the same input task; a
	// moved touch fires none, so the swallow ends with the task either way.
	#swallowRelease() {
		this.#swallowClick = true;
		setTimeout(() => (this.#swallowClick = false), 0);
	}

	// Capture phase, so neither the pressed control nor the router sees the
	// drag's click. A keyboard click (detail 0) is a new activation.
	clickAfterDrag = (event: MouseEvent) => {
		if (!event.isTrusted) return;
		const swallow = this.#swallowClick && event.detail > 0;
		this.#swallowClick = false;
		if (!swallow) return;
		event.preventDefault();
		event.stopPropagation();
	};
}
