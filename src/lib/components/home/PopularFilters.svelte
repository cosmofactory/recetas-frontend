<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import FilterBar from './FilterBar.svelte';
	import FiltersSheet from './FiltersSheet.svelte';

	// The mobile filter bar and the Filters sheet it opens. `active` is the
	// URL's filters; onToggle(id) and onClear ask the screen to navigate.
	type Props = {
		active: readonly string[];
		onToggle: (id: string) => void;
		onClear: () => void;
	};

	let { active, onToggle, onClear }: Props = $props();

	// In memory, not in the URL (stage FE-5 -> Small decisions). Desktop has
	// no Filters sheet, so crossing 860px closes it for good.
	const desktop = new MediaQuery(desktopQuery, false);
	let filtersOpen = $state(false);
	$effect.pre(() => {
		if (desktop.current) filtersOpen = false;
	});

	let filterBar: ReturnType<typeof FilterBar> | undefined = $state();

	export function focusFiltersButton() {
		filterBar?.focusFiltersButton();
	}

	// WebKit doesn't focus a button on click, so the sheet can't always
	// return focus itself.
	function closeFilters() {
		filtersOpen = false;
		focusFiltersButton();
	}
</script>

<div class="mobile-only">
	<FilterBar
		bind:this={filterBar}
		{active}
		{onToggle}
		onOpenFilters={() => (filtersOpen = true)}
		{filtersOpen}
	/>
	<FiltersSheet open={filtersOpen} {active} {onToggle} {onClear} onClose={closeFilters} />
</div>
