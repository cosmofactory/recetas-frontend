<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { SearchGroupKey } from '#lib/search/search-index.ts';
	import type { SearchGroup } from '#lib/search/search.ts';
	import SearchResultRow from './SearchResultRow.svelte';

	// The one listbox, a group per result group named by its heading (the
	// APG grouped listbox). Options are numbered in display order, which is
	// what the arrow keys move through; optionId(n) is the n-th option's id.
	type Props = {
		id: string;
		results: SearchGroup[];
		active: number;
		optionId: (position: number) => string;
		onSelect: (position: number) => void;
	};

	let { id, results, active, optionId, onSelect }: Props = $props();

	const GROUP_LABELS: Record<SearchGroupKey, () => string> = {
		dish: m.search_groups_0,
		variation: m.search_groups_1,
		region: m.search_groups_2
	};

	// The display position of each group's first option.
	const offsets = $derived(
		results.map((_, i) => results.slice(0, i).reduce((sum, r) => sum + r.entries.length, 0))
	);

	// A press on an option must not take focus from the combobox input.
	const keepFocus = (event: MouseEvent) => event.preventDefault();
</script>

<div {id} role="listbox" aria-label={m.a11y_search()} tabindex="-1" onmousedown={keepFocus}>
	{#each results as result, g (result.group)}
		<div class="group" role="group" aria-labelledby="{id}-{result.group}">
			<div class="heading" role="presentation" id="{id}-{result.group}">
				{GROUP_LABELS[result.group]()}
			</div>
			{#each result.entries as entry, i (entry)}
				<SearchResultRow
					{entry}
					id={optionId(offsets[g] + i)}
					active={active === offsets[g] + i}
					onSelect={() => onSelect(offsets[g] + i)}
				/>
			{/each}
		</div>
	{/each}
</div>

<style>
	/* Prototype: "flex-direction:column;padding-top:14px". */
	.group {
		display: flex;
		flex-direction: column;
		padding-top: 14px;
	}

	/* The "TRY" eyebrow's type, "padding-bottom:4px". */
	.heading {
		padding-bottom: 4px;
		color: var(--ink-eyebrow);
		font: 700 10.5px var(--font-text);
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
</style>
