<script lang="ts">
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { components } from '#lib/api/schema.d.ts';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import DishCard from '#lib/content/DishCard.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		clearFiltersHref,
		dishSheetHref,
		filterDishes,
		parseFilters,
		type FilterUrl
	} from '#lib/popular/filters.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { isPlainClick } from '#lib/ui/plain-click.ts';
	import FilterBar from './FilterBar.svelte';

	// url: the page URL, whose `f` params are the active filters (D-FE5-1).
	// onToggleFilter(id) and onClearFilters(href) ask the screen to navigate
	// (replacing the entry); the latter resolves once it has.
	type Props = {
		dishes: components['schemas']['Dish'][];
		url: FilterUrl;
		mediaBaseUrl: string | undefined;
		onToggleFilter: (id: string) => void;
		onClearFilters: (href: string) => Promise<void>;
	};

	let { dishes, url, mediaBaseUrl, onToggleFilter, onClearFilters }: Props = $props();

	const active = $derived(parseFilters(url));
	const shown = $derived(filterDishes(dishes, active));
	// The Filters sheet arrives with FE-5 PR 2.
	const openFilters = () => {};

	const desktop = new MediaQuery(desktopQuery, false);
	let filterBar: ReturnType<typeof FilterBar> | undefined = $state();
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
		else filterBar?.focusFiltersButton();
	}
</script>

<div class="popular page-container">
	<!-- The desktop <h1> lives in the Regional panel, so this panel names itself. -->
	<h2 class="visually-hidden">{m.home_popular()}</h2>
	<div class="controls">
		<div class="mobile-only">
			<FilterBar
				bind:this={filterBar}
				{active}
				onToggle={onToggleFilter}
				onOpenFilters={openFilters}
			/>
		</div>
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
	<div class="list">
		{#if shown.length > 0}
			<ul class="cards" role="list">
				{#each shown as dish (dish.key)}
					<li><DishCard {dish} href={dishSheetHref(url, dish.key)} {mediaBaseUrl} /></li>
				{/each}
			</ul>
		{:else}
			<div class="no-match" data-testid="no-match">
				<p class="no-match-text">{m.desktop_noMatch()}</p>
				<TextButton
					label={m.home_clearAll()}
					href={clearFiltersHref(url)}
					size="small"
					onclick={clearFilters}
				/>
			</div>
		{/if}
	</div>
</div>

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

	/*
	 * Prototype: the body is "flex:1; padding:14px 16px 16px" and the list
	 * scrolls in it ("flex:1; min-height:0; overflow-y:auto; scrollbar-width:
	 * none; gap:10px; padding:2px 2px 8px"); the home frame never scrolls.
	 */
	.list {
		flex: 1;
		min-height: 0;
		margin: 14px 16px 16px;
		padding: 2px 2px 8px;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
	}

	.list::-webkit-scrollbar {
		display: none;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Desktop prototype's empty state ("padding 48px 0", gap 12px, serif 24px) at the mobile card's 21px. */
	.no-match {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 0;
		text-align: center;
	}

	.no-match-text {
		margin: 0;
		font: 400 21px var(--font-display);
	}
</style>
