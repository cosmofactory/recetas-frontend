<script lang="ts">
	import { page } from '$app/state';
	import JsonLd from '#lib/components/JsonLd.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import DishPagesTopBar from '#lib/components/dish/DishPagesTopBar.svelte';
	import VariationsHeader from '#lib/components/dish/VariationsHeader.svelte';
	import { variationsBackPill } from '#lib/components/dish/back-pill.ts';
	import { variationsTitle } from '#lib/components/dish/dish-head.ts';
	import BackPill from '#lib/components/ui/BackPill.svelte';
	import StickyTopBar from '#lib/components/ui/StickyTopBar.svelte';
	import VariationCard from '#lib/content/VariationCard.svelte';
	import { headLinks } from '#lib/i18n/head-links.ts';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { recipeHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { popularDishHref } from '#lib/popular/filters.ts';
	import { variationsPageJsonLd } from '#lib/seo/dish-pages-json-ld.ts';
	import { ogImageUrl } from '#lib/seo/og-image.ts';
	import { originTab, type BackOrigin } from '#lib/ui/back-origin.ts';
	import { inAppBack } from '#lib/ui/in-app-back.ts';
	import type { PageProps } from './$types';

	// Mobile README -> Screen 2 (4a); desktop README -> Variations page. One
	// page for both layouts: CSS swaps the StickyTopBar (mobile) and the back
	// pill (desktop). The window scrolls (no inner scroller), so the top bar
	// tracks the window and Back restores the offset.
	let { data }: PageProps = $props();

	// Mobile README -> Screen 2: the bar's title and hairline appear past 230px.
	const BAR_THRESHOLD_PX = 230;

	const lang = $derived(localeFromPath(page.url.pathname));
	const dish = $derived(data.dish);
	let origin = $state<BackOrigin | null>(null);
	const back = inAppBack('variations-back', (next) => (origin = next));
	const pill = $derived(variationsBackPill(origin, lang));
	const image = $derived(
		ogImageUrl({
			origin: data.origin,
			mediaBaseUrl: data.mediaBaseUrl,
			heroPrefix: dish.photos.hero
		})
	);
	const jsonLd = $derived(
		variationsPageJsonLd(dish, {
			origin: data.origin,
			lang,
			url: headLinks(data.origin, page.url).canonical
		})
	);
</script>

<PageHead title={variationsTitle(dish.name)} description={dish.description} {image} />
<JsonLd data={jsonLd} />

<DishPagesTopBar {lang} tab={originTab(origin)} url={page.url} catalog={data} />
<main class="variations page-container">
	<div class="top-bar-slot mobile-only">
		<StickyTopBar
			backHref={popularDishHref(lang, dish.key)}
			backLabel={m.a11y_back()}
			title={dish.name}
			threshold={BAR_THRESHOLD_PX}
			onBack={back}
		/>
	</div>
	<div class="desktop-only">
		<BackPill label={pill.label} href={pill.href} onclick={back} />
	</div>
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
	/* The bar sticks to the window, so its slot makes no box of its own. */
	.top-bar-slot {
		display: contents;
	}

	/* Mobile README -> Screen 2 "Variation cards (padding 20px 20px 32px, gap 14px)". */
	.cards {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0;
		padding: 20px 20px 32px;
		list-style: none;
	}

	/*
	 * Desktop prototype (showDish): a 1440px-capped column, "padding:28px
	 * <side> 72px; gap:30px": the pill, the header grid, then the cards grid
	 * "repeat(auto-fill,minmax(300px,1fr)); gap:22px".
	 */
	@media (min-width: 860px) {
		.variations {
			display: flex;
			flex-direction: column;
			gap: 30px;
			padding-block: 28px 72px;
		}

		.cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
			gap: 22px;
			padding: 0;
		}
	}
</style>
