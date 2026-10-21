<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import TextButton from '#lib/components/ui/TextButton.svelte';
	import DishCard from '#lib/content/DishCard.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { clearFiltersHref, dishSheetHref, type FilterUrl } from '#lib/popular/filters.ts';

	// The Popular tab's filtered list, or its empty state. A card opens its
	// dish sheet (a link keeping the filters) and reports itself through
	// onOpenDish; onClear handles a click on the empty state's "Clear all" link.
	type Props = {
		dishes: components['schemas']['Dish'][];
		url: FilterUrl;
		mediaBaseUrl: string | undefined;
		onClear: (event: MouseEvent) => void;
		onOpenDish: (dishKey: string, card: HTMLElement) => void;
	};

	let { dishes, url, mediaBaseUrl, onClear, onOpenDish }: Props = $props();
</script>

<div class="list">
	{#if dishes.length > 0}
		<!-- reset false: focus stays on the card, so closing its sheet returns it there. -->
		<ul class="cards" role="list" data-sveltekit-reset="false">
			{#each dishes as dish (dish.key)}
				<li>
					<DishCard
						{dish}
						href={dishSheetHref(url, dish.key)}
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
				size="small"
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
</style>
