<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import type { components } from '#lib/api/schema.d.ts';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import DishCard from '#lib/content/DishCard.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { dishCardHref } from '#lib/popular/card-href.ts';
	import { clearFiltersHref, type FilterUrl } from '#lib/popular/filters.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';
	import { scrollSnapshot } from '#lib/ui/scroll-snapshot.ts';

	// The Popular tab's filtered list, or its empty state. A card opens its
	// dish sheet on mobile, the Variations page on desktop (dishCardHref), and
	// reports itself through onOpenDish; onClear handles a click on the empty
	// state's "Clear all" link.
	type Props = {
		dishes: components['schemas']['Dish'][];
		url: FilterUrl;
		mediaBaseUrl: string | undefined;
		onClear: (event: MouseEvent) => void;
		onOpenDish: (dishKey: string, card: HTMLElement) => void;
	};

	let { dishes, url, mediaBaseUrl, onClear, onOpenDish }: Props = $props();

	// The server renders the desktop link (true), the one that works on both
	// layouts without JavaScript; crossing 860px swaps the hrefs live.
	const desktop = new MediaQuery(desktopQuery, true);
	const layout = $derived(desktop.current ? 'desktop' : 'mobile');
	// Mobile: focus stays on the card, so closing its sheet returns it there.
	// Desktop: the Variations page gets the default scroll and focus reset.
	const reset = $derived(desktop.current ? undefined : 'false');

	// The mobile list scrolls itself, so its offset comes back with the entry
	// (D-FE6-1); on desktop the window scrolls and Kit restores that.
	let list: HTMLDivElement | undefined = $state();
	scrollSnapshot('home-popular-list', () => list);
</script>

<div bind:this={list} class="list">
	{#if dishes.length > 0}
		<ul class="cards" role="list" data-sveltekit-reset={reset}>
			{#each dishes as dish (dish.key)}
				<li>
					<DishCard
						{dish}
						href={dishCardHref(url, dish.key, layout)}
						{mediaBaseUrl}
						onclick={(event) => onOpenDish(dish.key, event.currentTarget)}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="no-match" data-testid="no-match">
			<p class="no-match-text">{m.desktop_noMatch()}</p>
			<TextButton
				label={m.home_clearAll()}
				href={clearFiltersHref(url)}
				size="medium"
				onclick={onClear}
			/>
		</div>
	{/if}
</div>

<style>
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

	/*
	 * Desktop README -> Popular: "card grid repeat(auto-fill, minmax(250px,
	 * 1fr)), gap 20px"; the empty state's noMatch is serif 24px. The window
	 * scrolls, so the list is no scroll container (sticky needs that too).
	 */
	@media (min-width: 860px) {
		.list {
			flex: none;
			margin: 0;
			padding: 0;
			overflow: visible;
		}

		.cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
			gap: 20px;
		}

		.no-match-text {
			font-size: 24px;
		}
	}
</style>
