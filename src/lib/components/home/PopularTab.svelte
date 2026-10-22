<script lang="ts">
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { components } from '#lib/api/schema.d.ts';
	import { m } from '#lib/paraglide/messages.js';
	import {
		clearFiltersHref,
		filterDishes,
		openDishKey,
		parseFilters,
		type DishUrl
	} from '#lib/popular/filters.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { isPlainClick } from '#lib/ui/plain-click.ts';
	import { sheetOpener } from '#lib/ui/sheet-opener.ts';
	import DishResults from './DishResults.svelte';
	import DishSheet from './DishSheet.svelte';
	import PopularFilters from './PopularFilters.svelte';
	import PopularSidebar from './PopularSidebar.svelte';
	import ResultCount from './ResultCount.svelte';

	// url: the page URL, whose `f` params are the active filters (D-FE5-1)
	// and `dish` the open dish sheet (D-FE5-2). onToggleFilter(id) and
	// onClearFilters(href) ask the screen to navigate (replacing the entry);
	// the latter resolves once it has. onCloseDish leaves the dish sheet.
	type Props = {
		dishes: components['schemas']['Dish'][];
		url: DishUrl;
		lang: string;
		mediaBaseUrl: string | undefined;
		onToggleFilter: (id: string) => void;
		onClearFilters: (href: string) => Promise<void>;
		onCloseDish: () => void;
	};

	let { dishes, url, lang, mediaBaseUrl, onToggleFilter, onClearFilters, onCloseDish }: Props =
		$props();

	const active = $derived(parseFilters(url));
	const shown = $derived(filterDishes(dishes, active));
	const openDish = $derived(dishes.find((dish) => dish.key === openDishKey(url)));

	const desktop = new MediaQuery(desktopQuery, false);

	// The card that opened the dish sheet gets focus back when it closes.
	const dishOpener = sheetOpener();

	let filters: ReturnType<typeof PopularFilters> | undefined = $state();
	let resultCount: ReturnType<typeof ResultCount> | undefined = $state();

	// The Filters sheet's and the sidebar's "Clear all": focus stays on it.
	const clearAll = () => void onClearFilters(clearFiltersHref(url));

	// The empty state's "Clear all" keeps its href (no JS, new tab); a plain
	// click replaces the entry like a chip does.
	async function clearFilters(event: MouseEvent) {
		if (!isPlainClick(event)) return;
		event.preventDefault();
		await onClearFilters(clearFiltersHref(url));
		await tick();
		focusAfterClear();
	}

	// The link goes with the empty state. Mobile: the Filters button. Desktop:
	// the result count, where the empty state was, which also reads out the
	// restored count.
	function focusAfterClear() {
		if (desktop.current) resultCount?.focus();
		else filters?.focusFiltersButton();
	}
</script>

<div class="popular">
	<!-- The desktop <h1> lives in the Regional panel, so this panel names itself. -->
	<h2 class="visually-hidden">{m.home_popular()}</h2>
	<div class="layout page-container">
		<PopularSidebar {active} onToggle={onToggleFilter} onClear={clearAll} />
		<div class="results">
			<div class="controls">
				<PopularFilters bind:this={filters} {active} onToggle={onToggleFilter} onClear={clearAll} />
				<ResultCount bind:this={resultCount} count={shown.length} />
			</div>
			<DishResults
				dishes={shown}
				{url}
				{mediaBaseUrl}
				onClear={clearFilters}
				onOpenDish={dishOpener.remember}
			/>
		</div>
	</div>
</div>
<DishSheet
	dish={openDish}
	active={!desktop.current}
	{lang}
	{mediaBaseUrl}
	onClose={onCloseDish}
	opener={() => dishOpener.forKey(openDish?.key)}
/>

<style>
	/* Mobile: one column filling the home frame (the list scrolls inside it). */
	.popular,
	.layout,
	.results {
		display: flex;
		flex: 1;
		flex-direction: column;
		width: 100%;
		min-height: 0;
	}

	/*
	 * Mobile prototype: the filter bar and the result count continue the
	 * header's column (gap 16px under the switch).
	 */
	.controls {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 16px;
		padding: 16px 20px 0;
	}

	/*
	 * Desktop README -> Popular: "grid 220px minmax(0,1fr) ... Right: result
	 * count, then card grid". The prototype: "padding:28px <side> 64px;
	 * align-items:start" (the sidebar sticks), the results "flex column;
	 * gap:18px". The window scrolls, so no ancestor of the sidebar may clip.
	 */
	@media (min-width: 860px) {
		.layout {
			display: grid;
			grid-template-columns: 220px minmax(0, 1fr);
			gap: var(--desktop-gap);
			align-items: start;
			padding-block: 28px 64px;
		}

		.results {
			gap: 18px;
		}

		.controls {
			padding: 0;
		}
	}
</style>
