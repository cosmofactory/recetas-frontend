import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Search from '@lucide/svelte/icons/search';
import X from '@lucide/svelte/icons/x';

// The icon set both READMEs list under Assets: "magnifier, back chevron,
// close ×, check ✓" (stack.md F5: @lucide/svelte, one import per icon), the
// desktop language button's "▾" caret and the desktop region row's "›".
export const ICONS = {
	search: Search,
	back: ChevronLeft,
	close: X,
	check: Check,
	caret: ChevronDown,
	forward: ChevronRight
};

export type IconName = keyof typeof ICONS;

// Mobile README -> Header: "magnifier icon in ink (use your icon set; 15px)".
export const ICON_SIZE_PX = 15;

// Both READMEs: the language button's "▾" is 9px text; the chevron needs a
// little more to read the same.
export const CARET_ICON_PX = 12;
