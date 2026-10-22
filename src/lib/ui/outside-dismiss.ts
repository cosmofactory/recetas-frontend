// A popup that isn't modal (the desktop search dropdown) closes when the
// user presses or moves focus outside it, without swallowing that press: a
// click on a link or a control behind it still does its own thing.

// Calls onOutside for every press that starts outside `container`; returns
// the cleanup.
export function onPointerDownOutside(container: HTMLElement, onOutside: () => void): () => void {
	const onPointerDown = (event: PointerEvent) => {
		if (event.target instanceof Node && container.contains(event.target)) return;
		onOutside();
	};
	document.addEventListener('pointerdown', onPointerDown);
	return () => document.removeEventListener('pointerdown', onPointerDown);
}

// Whether a focusout moves focus to another element outside `container`
// (Tab past its last control). Focus going nowhere (a press on plain text,
// the window losing focus) doesn't count.
export function focusLeft(event: FocusEvent, container: HTMLElement): boolean {
	const next = event.relatedTarget;
	return next instanceof Node && !container.contains(next);
}
