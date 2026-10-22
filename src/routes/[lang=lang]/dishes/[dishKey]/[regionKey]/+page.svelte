<script lang="ts">
	import { page } from '$app/state';
	import DishPagesTopBar from '#lib/components/dish/DishPagesTopBar.svelte';
	import { recipeBackPill } from '#lib/components/dish/back-pill.ts';
	import { recipeTitle } from '#lib/components/dish/dish-head.ts';
	import RecipeBody from '#lib/components/recipe/RecipeBody.svelte';
	import BackPill from '#lib/components/ui/BackPill.svelte';
	import StickyTopBar from '#lib/components/ui/StickyTopBar.svelte';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { variationsHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { originTab, type BackOrigin } from '#lib/ui/back-origin.ts';
	import { inAppBack } from '#lib/ui/in-app-back.ts';
	import type { PageProps } from './$types';

	// Mobile README -> Screen 3 (5a); desktop README -> Recipe page. One page
	// for both layouts, like the Variations page. The window scrolls.
	let { data }: PageProps = $props();

	// Mobile README -> Screen 3: the bar's title and hairline appear past 280px.
	const BAR_THRESHOLD_PX = 280;

	const lang = $derived(localeFromPath(page.url.pathname));
	const recipe = $derived(data.recipe);
	// SvelteKit reuses this component on a Recipe → Recipe navigation, so the
	// servings and ticks are keyed on the recipe to start fresh.
	const recipeId = $derived(`${recipe.dishKey}/${recipe.regionKey}`);
	let origin = $state<BackOrigin | null>(null);
	const back = inAppBack('recipe-back', (next) => (origin = next));
	const pill = $derived(recipeBackPill(origin, recipe, lang, data));
</script>

<svelte:head>
	<title>{recipeTitle(recipe.dishName, recipe.name)}</title>
	<meta name="description" content={recipe.description} />
</svelte:head>

<DishPagesTopBar {lang} tab={originTab(origin)} url={page.url} catalog={data} />
<main class="recipe page-container">
	<div class="top-bar-slot mobile-only">
		<StickyTopBar
			backHref={variationsHref(recipe.dishKey, lang)}
			backLabel={m.a11y_back()}
			title={recipe.name}
			threshold={BAR_THRESHOLD_PX}
			onBack={back}
		/>
	</div>
	<div class="desktop-only">
		<BackPill label={pill.label} href={pill.href} onclick={back} />
	</div>
	{#key recipeId}
		<RecipeBody {recipe} {lang} mediaBaseUrl={data.mediaBaseUrl} />
	{/key}
</main>

<style>
	/* The bar sticks to the window, so its slot makes no box of its own. */
	.top-bar-slot {
		display: contents;
	}

	/*
	 * Desktop prototype (showRecipe): a 1440px-capped column, "padding:28px
	 * <side> 80px; gap:30px": the pill, the hero grid, then the body grid.
	 * The window scrolls, so nothing here sets overflow (the sticky card).
	 */
	@media (min-width: 860px) {
		.recipe {
			display: flex;
			flex-direction: column;
			gap: 30px;
			padding-block: 28px 80px;
		}
	}
</style>
