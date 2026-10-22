import { menuItemIndex, type MenuFocus } from './menu-keys.ts';
import { sheetKeyboard } from './sheet-keyboard.svelte.ts';

type MenuKeyboardOptions = {
	menu: () => HTMLElement | undefined;
	open: () => boolean;
	// The item focused on opening.
	initialFocus: () => MenuFocus;
	onClose: () => void;
	opener?: () => HTMLElement | undefined;
};

const ITEM_SELECTOR = '[role="menuitem"]';

// An APG menu's keyboard and focus behaviour: Escape closes it (the `menu`
// escape layer, never modal) and focus returns to the opener; opening focuses
// the first or last item; the arrows, Home and End move between the items and
// Tab leaves (and closes) it. Call during component init; put the returned
// handler on the menu element.
export function menuKeyboard(options: MenuKeyboardOptions): (event: KeyboardEvent) => void {
	sheetKeyboard({
		sheet: options.menu,
		kind: 'menu',
		shown: options.open,
		modal: () => false,
		onEscape: () => options.onClose(),
		opener: options.opener
	});

	const items = () => [...(options.menu()?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];

	$effect(() => {
		if (!options.open()) return;
		const all = items();
		all[options.initialFocus() === 'last' ? all.length - 1 : 0]?.focus();
	});

	return (event) => {
		if (event.key === 'Tab') return options.onClose();
		const all = items();
		const current = all.indexOf(document.activeElement as HTMLElement);
		const next = menuItemIndex(event.key, current, all.length);
		if (next === undefined) return;
		event.preventDefault();
		all[next].focus();
	};
}
