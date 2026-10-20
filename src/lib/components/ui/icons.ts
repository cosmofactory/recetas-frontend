import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import Search from '@lucide/svelte/icons/search';
import X from '@lucide/svelte/icons/x';

// The icon set both READMEs list under Assets: "magnifier, back chevron,
// close ×, check ✓" (stack.md F5: @lucide/svelte, one import per icon), and
// the desktop language button's "▾" caret.
export const ICONS = {
	search: Search,
	back: ChevronLeft,
	close: X,
	check: Check,
	caret: ChevronDown
};

export type IconName = keyof typeof ICONS;

// Mobile README -> Header: "magnifier icon in ink (use your icon set; 15px)".
export const ICON_SIZE_PX = 15;
