import { pushEscapeLayer, type EscapeLayerKind } from './escape-layers.ts';
import { rememberFocus, trapFocus } from './focus-trap.ts';

type SheetKeyboardOptions = {
	sheet: () => HTMLElement | undefined;
	kind: EscapeLayerKind;
	// While shown, Escape asks to close (topmost layer only) and focus returns
	// to the opener once it hides.
	shown: () => boolean;
	// While modal, Tab is trapped inside.
	modal: () => boolean;
	onEscape: () => void;
};

// The keyboard and focus behaviour both sheets share; call it during
// component init.
export function sheetKeyboard(options: SheetKeyboardOptions) {
	// Derived, so the effects rerun only when the flags flip, not on every
	// state change: peek → expanded must not re-remember the handle.
	const shown = $derived(options.shown());
	const modal = $derived(options.modal());

	$effect(() => {
		if (!shown) return;
		const restore = rememberFocus();
		const removeLayer = pushEscapeLayer(options.kind, () => options.onEscape());
		return () => {
			removeLayer();
			restore(options.sheet());
		};
	});

	$effect(() => {
		const sheet = options.sheet();
		if (!modal || !sheet) return;
		return trapFocus(sheet);
	});
}
