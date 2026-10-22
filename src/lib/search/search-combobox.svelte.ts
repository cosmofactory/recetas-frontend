import { movedActiveOption, NO_ACTIVE_OPTION } from './active-option.ts';
import { normalize } from './normalize.ts';
import type { SearchEntry } from './search-index.ts';
import { search, type SearchGroup } from './search.ts';

// The search combobox's in-memory state (stage FE-7: the query is never in
// the URL or storage): the query, its results and the active option.
export class SearchCombobox {
	query = $state('');
	active = $state(NO_ACTIVE_OPTION);
	readonly results: SearchGroup[];
	readonly entries: SearchEntry[];
	// Prototype: the suggestions show while the trimmed query normalises to nothing.
	readonly blank: boolean;

	constructor(index: () => SearchEntry[]) {
		this.results = $derived(search(index(), this.query));
		this.entries = $derived(this.results.flatMap((result) => result.entries));
		this.blank = $derived(normalize(this.query.trim()) === '');
	}

	get activeEntry(): SearchEntry | undefined {
		return this.entries[this.active];
	}

	// Typing (or any new query) drops the active option.
	setQuery(next: string) {
		this.query = next;
		this.active = NO_ACTIVE_OPTION;
	}

	// The input's keys: the arrows move the active option, Enter picks it.
	onKeydown(event: KeyboardEvent, onSelect: (entry: SearchEntry) => void) {
		const moved = movedActiveOption(event.key, this.active, this.entries.length);
		if (moved !== undefined) {
			event.preventDefault();
			this.active = moved;
			return;
		}
		const entry = this.activeEntry;
		if (event.key !== 'Enter' || !entry) return;
		event.preventDefault();
		onSelect(entry);
	}
}
