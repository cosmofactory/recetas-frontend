// APG menu: the keys that move focus between a menu's items. Arrows wrap at
// either end; Home and End jump to the first and last item. `current` is -1
// when focus is on the menu itself: ArrowDown then goes to the first item and
// ArrowUp to the last.

export type MenuFocus = 'first' | 'last';

// The item index `key` moves to from `current`, or undefined for any other key.
export function menuItemIndex(key: string, current: number, count: number): number | undefined {
	if (key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowUp') return current < 0 ? count - 1 : (current - 1 + count) % count;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	return undefined;
}

// The menu button's opening keys besides Enter and Space (which click it):
// ArrowDown opens on the first item, ArrowUp on the last.
export function openingFocus(key: string): MenuFocus | undefined {
	if (key === 'ArrowDown') return 'first';
	if (key === 'ArrowUp') return 'last';
	return undefined;
}
