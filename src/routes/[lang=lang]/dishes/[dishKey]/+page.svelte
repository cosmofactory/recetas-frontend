<script lang="ts">
	import { page } from '$app/state';
	import VariationsHeader from '#lib/components/dish/VariationsHeader.svelte';
	import { variationsTitle } from '#lib/components/dish/dish-head.ts';
	import StickyTopBar from '#lib/components/ui/StickyTopBar.svelte';
	import VariationCard from '#lib/content/VariationCard.svelte';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { recipeHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { popularDishHref } from '#lib/popular/filters.ts';
	import { inAppBack } from '#lib/ui/in-app-back.ts';
	import type { PageProps } from './$types';

	// Mobile README -> Screen 2 (4a). Until FE-6 PR 4 desktop shows this
	// layout too. The window scrolls (no inner scroller), so the top bar
	// tracks the window and Back restores the offset.
	let { data }: PageProps = $props();

	// Mobile README -> Screen 2: the bar's title and hairline appear past 230px.
	const BAR_THRESHOLD_PX = 230;

	const lang = $derived(localeFromPath(page.url.pathname));
	const dish = $derived(data.dish);
	const back = inAppBack('variations-back');
</script>

<svelte:head>
	<title>{variationsTitle(dish.name)}</title>
	<meta name="description" content={dish.description} />
</svelte:head>

<main>
	<StickyTopBar
		backHref={popularDishHref(lang, dish.key)}
		backLabel={m.a11y_back()}
		title={dish.name}
		threshold={BAR_THRESHOLD_PX}
		onBack={back}
	/>
	<VariationsHeader {dish} mediaBaseUrl={data.mediaBaseUrl} />
	<!-- All variations are equal, in the API's region order. -->
	<ul class="cards" role="list">
		{#each dish.variations as variation (variation.regionKey)}
			<li>
				<VariationCard
					{variation}
					href={recipeHref(dish.key, variation.regionKey, lang)}
					mediaBaseUrl={data.mediaBaseUrl}
				/>
			</li>
		{/each}
	</ul>
</main>

<style>
	/* Mobile README -> Screen 2 "Variation cards (padding 20px 20px 32px, gap 14px)". */
	.cards {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0;
		padding: 20px 20px 32px;
		list-style: none;
	}
</style>
