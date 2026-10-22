<script lang="ts">
	import Chip from '#lib/components/ui/Chip.svelte';
	import ChipRow from '#lib/components/ui/ChipRow.svelte';
	import { filterGroupLabel, filterLabel } from '#lib/popular/filter-labels.ts';
	import { FILTER_GROUPS } from '#lib/popular/filters.ts';

	// The Filters sheet's (mobile) and the filter sidebar's (desktop) four
	// groups. Controlled like FilterBar: `active` is the URL's filters, a
	// press asks the screen to toggle (onToggle). `size` picks the sheet's
	// or the sidebar's metrics.
	type Props = {
		active: readonly string[];
		onToggle: (id: string) => void;
		size?: 'regular' | 'desktop';
	};

	let { active, onToggle, size = 'regular' }: Props = $props();

	// Unique per instance: the sheet and the sidebar can both be in the page.
	const uid = $props.id();
</script>

<div class="filter-groups" class:desktop={size === 'desktop'} data-testid="filter-groups">
	{#each FILTER_GROUPS as group (group.key)}
		{@const labelId = `${uid}-${group.key}`}
		<div class="group" role="group" aria-labelledby={labelId}>
			<span class="eyebrow" id={labelId}>{filterGroupLabel(group.key)}</span>
			<ChipRow wrap {size}>
				{#each group.ids as id (id)}
					<Chip
						label={filterLabel(id)}
						pressed={active.includes(id)}
						onToggle={() => onToggle(id)}
						{size}
					/>
				{/each}
			</ChipRow>
		</div>
	{/each}
</div>

<style>
	/*
	 * Mobile README -> Filters sheet: "Four groups, each an eyebrow label
	 * (10px/700, .11em, ink-4) + wrapping chip row (gap 7px)"; the prototype
	 * stacks a group's eyebrow and chips with gap 7px, the groups with the
	 * sheet's 14px. ink-4 misses AA, so the eyebrow is --ink-eyebrow (X10).
	 */
	.filter-groups {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.eyebrow {
		color: var(--ink-eyebrow);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	/*
	 * Desktop prototype, filter sidebar: the groups in its "gap:22px" column,
	 * each "flex column; gap:9px" with a "10.5px/700, .11em" eyebrow.
	 */
	.filter-groups.desktop {
		gap: 22px;
	}

	.desktop .group {
		gap: 9px;
	}

	.desktop .eyebrow {
		font-size: 10.5px;
	}
</style>
