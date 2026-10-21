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
	let resultCount: HTMLElement | undefined = $state();

	// "Clear all" keeps its href (no JS, new tab); a plain click replaces the
	// entry like a chip does.
	async function clearFilters(event: MouseEvent) {
		if (!isPlainClick(event)) return;
		event.preventDefault();
		await onClearFilters(clearFiltersHref(url));
		await tick();
		focusAfterClear();
	}

	// The link goes with the empty state. Mobile: the Filters button. Desktop
	// has none until PR 3's sidebar, so the result count (tabindex -1), which
	// also reads out the restored count.
	function focusAfterClear() {
		if (desktop.current) resultCount?.focus();
		else filters?.focusFiltersButton();
	}
</script>

<div class="popular page-container">
	<!-- The desktop <h1> lives in the Regional panel, so this panel names itself. -->
	<h2 class="visually-hidden">{m.home_popular()}</h2>
	<div class="controls">
		<PopularFilters
			bind:this={filters}
			{active}
			onToggle={onToggleFilter}
			onClear={() => void onClearFilters(clearFiltersHref(url))}
		/>
		<p
			bind:this={resultCount}
			class="result-count"
			data-testid="result-count"
			aria-live="polite"
			tabindex="-1"
		>
			{m.home_dish({ count: shown.length })}
		</p>
	</div>
	<DishResults
		dishes={shown}
		{url}
		{mediaBaseUrl}
		onClear={clearFilters}
		onOpenDish={dishOpener.remember}
	/>
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
	.popular {
		display: flex;
		flex: 1;
		flex-direction: column;
		width: 100%;
		min-height: 0;
	}

	/*
	 * Mobile prototype: the filter bar and the result count continue the
	 * header's column (gap 16px under the switch); the README's result count
	 * is "padding 0 3px ... eyebrow 11px/700, .09em, ink-3".
	 */
	.controls {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 16px;
		padding: 16px 20px 0;
	}

	.result-count {
		margin: 0;
		padding: 0 3px;
		color: var(--ink-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
</style>
