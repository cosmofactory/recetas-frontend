import { untrack } from 'svelte';
import { pushEscapeLayer, type EscapeLayerKind } from './escape-layers.ts';
import { rememberFocus, trapFocus, type InitialFocus } from './focus-trap.ts';

type SheetKeyboardOptions = {
	sheet: () => HTMLElement | undefined;
	kind: EscapeLayerKind;
	// While shown, Escape asks to close (topmost layer only) and focus returns
	// to the opener once it hides.
	shown: () => boolean;
	// While modal, Tab is trapped inside.
	modal: () => boolean;
	onEscape: () => void;
	// The control that opened it, when the screen knows (WebKit doesn't focus
	// a link on click); otherwise the focused element.
	opener?: () => HTMLElement | undefined;
	// Where focus moves when it goes modal (trapFocus's initialFocus).
	initialFocus?: InitialFocus;
};

// Another sheet (role="dialog"), whose own focus return moves focus here.
const OTHER_LAYER_SELECTOR = '[role="dialog"]';

// A sheet already shown when the page loads (peek at mount, a deep link) had
// no opener: focus was on <body>. So the opener is the last control outside
// the sheet that focus came in from.
function trackOpener(sheet: HTMLElement | undefined, onOpener: (opener: HTMLElement) => void) {
	if (!sheet) return () => {};
	const onFocusIn = (event: FocusEvent) => {
		const from = event.relatedTarget;
		if (!(from instanceof HTMLElement) || sheet.contains(from)) return;
		if (from.closest(OTHER_LAYER_SELECTOR)) return;
		onOpener(from);
	};
	sheet.addEventListener('focusin', onFocusIn);
	return () => sheet.removeEventListener('focusin', onFocusIn);
}

// The keyboard and focus behaviour the sheets and the search overlay share;
// call it during component init.
export function sheetKeyboard(options: SheetKeyboardOptions) {
	// Derived, so the effects rerun only when the flags flip, not on every
	// state change: peek → expanded must not re-remember the handle.
	const shown = $derived(options.shown());
	const modal = $derived(options.modal());

	$effect(() => {
		if (!shown) return;
		let restore = rememberFocus(untrack(() => options.opener?.()));
		const stopTracking = trackOpener(
			options.sheet(),
			(opener) => (restore = rememberFocus(opener))
		);
		const removeLayer = pushEscapeLayer(options.kind, () => options.onEscape());
		return () => {
			stopTracking();
			removeLayer();
			restore(options.sheet());
		};
	});

	$effect(() => {
		const sheet = options.sheet();
		if (!modal || !sheet) return;
		return trapFocus(sheet, { initialFocus: options.initialFocus });
	});
}
