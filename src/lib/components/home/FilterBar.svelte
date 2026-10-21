<script lang="ts">
	import Chip from '#lib/components/ui/Chip.svelte';
	import ChipRow from '#lib/components/ui/ChipRow.svelte';
	import { filterLabel, filtersButtonLabel } from '#lib/popular/filter-labels.ts';
	import { QUICK_FILTER_IDS } from '#lib/popular/filters.ts';

	// Controlled: `active` is the URL's filters; a chip press asks the screen
	// to navigate (onToggle), the Filters button to open the sheet, whose
	// open state the screen owns (filtersOpen).
	type Props = {
		active: readonly string[];
		onToggle: (id: string) => void;
		onOpenFilters: () => void;
		filtersOpen: boolean;
	};

	let { active, onToggle, onOpenFilters, filtersOpen }: Props = $props();

	const hasActive = $derived(active.length > 0);

	let filtersButton: HTMLButtonElement | undefined = $state();

	// For a screen that removes the control that had focus (e.g. "Clear all")
	// or closes the sheet (WebKit doesn't focus a button on click, so the
	// sheet can't always return focus itself).
	export function focusFiltersButton() {
		filtersButton?.focus();
	}
</script>

<div class="filter-bar" data-testid="filter-bar">
	<ChipRow>
		<button
			bind:this={filtersButton}
			type="button"
			class="filters-button"
			data-active={hasActive ? 'true' : undefined}
			aria-haspopup="dialog"
			aria-expanded={filtersOpen}
			onclick={onOpenFilters}
		>
			{filtersButtonLabel(active.length)}
		</button>
		{#each QUICK_FILTER_IDS as id (id)}
			<Chip label={filterLabel(id)} pressed={active.includes(id)} onToggle={() => onToggle(id)} />
		{/each}
	</ChipRow>
</div>

<style>
	/*
	 * Mobile README -> Filter bar: "Filters button — pill, padding 8px 13px,
	 * 12px/700 ... when N>0 it fills ink with --on-accent text"; the
	 * prototype's border is --border-chip, ink when N>0.
	 */
	.filters-button {
		position: relative;
		flex: none;
		padding: 8px 13px;
		border: 1px solid var(--border-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		font: 700 12px var(--font-text);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--dur-colour),
			border-color var(--dur-colour),
			color var(--dur-colour);
	}

	.filters-button::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.filters-button[data-active='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--on-accent);
	}
</style>
