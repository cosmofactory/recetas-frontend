// The one focus trap and focus return both sheets use (both READMEs ->
// Accessibility: "Sheets: focus-trap when expanded, Escape closes").

const TABBABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]'
].join(',');

// Safari 16–17.3 (in stack.md X10's Browserslist) lack checkVisibility.
function isRendered(el: HTMLElement): boolean {
	if (typeof el.checkVisibility === 'function')
		return el.checkVisibility({ visibilityProperty: true });
	return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function isTabbable(el: HTMLElement): boolean {
	if (el.tabIndex < 0 || el.matches(':disabled') || el.closest('[inert]')) return false;
	return isRendered(el);
}

// The elements Tab can reach inside `container`, in DOM order.
export function tabbableWithin(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(isTabbable);
}

// Wraps Tab at either end; the list is read per keypress, so content added
// while the trap is active is included.
function cycleTab(container: HTMLElement, event: KeyboardEvent) {
	// A trap nested inside this one already moved focus.
	if (event.defaultPrevented) return;
	const tabbable = tabbableWithin(container);
	const active = document.activeElement;
	const first = tabbable[0];
	const last = tabbable[tabbable.length - 1];
	let target: HTMLElement | undefined;
	if (!first) target = container;
	else if (event.shiftKey && (active === first || active === container)) target = last;
	else if (!event.shiftKey && active === last) target = first;
	if (!target) return;
	event.preventDefault();
	target.focus();
}

// Keeps Tab inside `container` until the returned release is called. Focus
// moves in unless it is already there (e.g. on the handle that expanded the
// sheet). Escape is not handled here but by escape-layers.ts.
export function trapFocus(container: HTMLElement): () => void {
	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Tab') cycleTab(container, event);
	};
	container.addEventListener('keydown', onKeydown);
	if (!container.contains(document.activeElement)) {
		(tabbableWithin(container)[0] ?? container).focus();
	}
	return () => container.removeEventListener('keydown', onKeydown);
}

// Whether focus is lost (on <body>) or still inside `within`.
function focusIsLostOrIn(within: HTMLElement | undefined): boolean {
	const active = document.activeElement;
	if (!within || active === null || active === document.body) return true;
	return within.contains(active);
}

// Captures the focused element (the opener); the returned restore focuses it
// again if it is still in the document. Given the sheet, it does so only when
// focus is still in it or lost, so a user who has moved on keeps their place.
export function rememberFocus(): (within?: HTMLElement) => void {
	const opener = document.activeElement;
	return (within) => {
		if (!(opener instanceof HTMLElement) || !opener.isConnected) return;
		if (focusIsLostOrIn(within)) opener.focus();
	};
}
