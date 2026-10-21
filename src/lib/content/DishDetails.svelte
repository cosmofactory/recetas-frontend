<script lang="ts">
	import type { components } from '#lib/api/schema.d.ts';
	import PrimaryButton from '#lib/components/ui/PrimaryButton.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import DishVariationRow from './DishVariationRow.svelte';

	// The dish sheet's content (mobile). Variations come in region order and
	// stay in it: all are equal, none is counted or highlighted.
	// recipeHref(dishKey, regionKey) is a row's link, variationsHref "See all".
	type Props = {
		dish: components['schemas']['Dish'];
		variationsHref: string;
		recipeHref: (dishKey: string, regionKey: string) => string;
		mediaBaseUrl: string | undefined;
	};

	let { dish, variationsHref, recipeHref, mediaBaseUrl }: Props = $props();
</script>

<div class="dish-details" data-testid="dish-details">
	<div class="title-row">
		<h2 class="name">{dish.name}</h2>
		<span class="count">{m.home_variation({ count: dish.variations.length })}</span>
	</div>
	<p class="description">{dish.description}</p>
	<ul class="rows" role="list">
		{#each dish.variations as variation (variation.regionKey)}
			<li>
				<DishVariationRow
					{variation}
					href={recipeHref(dish.key, variation.regionKey)}
					{mediaBaseUrl}
				/>
			</li>
		{/each}
	</ul>
	<PrimaryButton label={m.home_seeAll()} href={variationsHref} />
</div>

<style>
	/*
	 * Mobile README -> Dish detail sheet: "Content (gap 12px): Row: dish name
	 * (Instrument Serif 27px, lh 1.05) + "N variations" (11.5px/700, accent).
	 * Description (12.5px, ink-2). Variation list (max-height 200px, scrolls,
	 * scrollbar hidden)"; the prototype gives the padding, the title row's
	 * baseline and gap, the count's nowrap and the description's line-height
	 * and margin.
	 */
	.dish-details {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 22px 22px;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	.name {
		margin: 0;
		font: 400 27px / 1.05 var(--font-display);
	}

	.count {
		color: var(--accent-text);
		font-size: 11.5px;
		font-weight: 700;
		white-space: nowrap;
	}

	.description {
		margin: -4px 0 0;
		color: var(--ink-2);
		font-size: 12.5px;
		line-height: 1.45;
	}

	.rows {
		display: flex;
		flex-direction: column;
		max-height: 200px;
		margin: 0;
		padding: 0;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
		scrollbar-width: none;
	}

	.rows::-webkit-scrollbar {
		display: none;
	}
</style>
