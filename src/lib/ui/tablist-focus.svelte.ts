import { tabIndexForKey } from './tablist.ts';

type Options = {
	tabs: () => HTMLElement[];
	// WAI-ARIA tabs: 'auto' selects as the keys move focus; 'manual' only
	// moves focus, and Enter or a click activates.
	activation: () => 'auto' | 'manual';
	select: (index: number) => void;
};

// The tablist's roving tabindex and arrow keys (tabIndexForKey).
export class TablistFocus {
	// Manual activation: the tab the keys last moved focus to.
	focusedIndex = $state<number | undefined>(undefined);
	readonly #options: Options;

	constructor(options: Options) {
		this.#options = options;
	}

	// A value no option has must not take the switch out of the Tab order.
	tabStop(selectedIndex: number): number {
		return this.focusedIndex ?? Math.max(selectedIndex, 0);
	}

	moveWithKey = (event: KeyboardEvent, index: number) => {
		const tabs = this.#options.tabs();
		const next = tabIndexForKey(event.key, index, tabs.length);
		if (next === undefined) return;
		event.preventDefault();
		if (this.#options.activation() === 'auto') this.#options.select(next);
		else this.focusedIndex = next;
		tabs[next].focus();
	};

	// Leaving the switch hands the Tab stop back to the selected tab.
	forgetFocus = (event: FocusEvent) => {
		const next = event.relatedTarget;
		const inside = next instanceof HTMLElement && this.#options.tabs().includes(next);
		if (!inside) this.focusedIndex = undefined;
	};
}
