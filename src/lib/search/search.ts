import { normalize } from './normalize.ts';
import { SEARCH_GROUPS, type SearchEntry, type SearchGroupKey } from './search-index.ts';

// Both READMEs -> Overlay — Search: "max 6 each".
export const MAX_RESULTS_PER_GROUP = 6;

export type SearchGroup = { group: SearchGroupKey; entries: SearchEntry[] };

// A substring match in index order; only non-empty groups, in display order.
export function search(index: SearchEntry[], query: string): SearchGroup[] {
	const needle = normalize(query.trim());
	if (!needle) return [];
	const matches = index.filter((entry) => entry.haystack.includes(needle));
	return SEARCH_GROUPS.map((group) => ({
		group,
		entries: matches.filter((entry) => entry.group === group).slice(0, MAX_RESULTS_PER_GROUP)
	})).filter((result) => result.entries.length > 0);
}
