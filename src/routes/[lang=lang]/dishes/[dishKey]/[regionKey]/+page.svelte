<script lang="ts">
	import { page } from '$app/state';
	import { recipeTitle } from '#lib/components/dish/dish-head.ts';
	import RecipeBody from '#lib/components/recipe/RecipeBody.svelte';
	import RecipeHeader from '#lib/components/recipe/RecipeHeader.svelte';
	import StickyTopBar from '#lib/components/ui/StickyTopBar.svelte';
	import { localeFromPath } from '#lib/i18n/locales.ts';
	import { variationsHref } from '#lib/i18n/localized-href.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { inAppBack } from '#lib/ui/in-app-back.ts';
	import type { PageProps } from './$types';

	// Mobile README -> Screen 3 (5a). Until FE-6 PR 4 desktop shows this
	// layout too. The window scrolls, like the Variations page.
	let { data }: PageProps = $props();

	// Mobile README -> Screen 3: the bar's title and hairline appear past 280px.
	const BAR_THRESHOLD_PX = 280;

	const lang = $derived(localeFromPath(page.url.pathname));
	const recipe = $derived(data.recipe);
	// SvelteKit reuses this component on a Recipe → Recipe navigation, so the
	// servings and ticks are keyed on the recipe to start fresh.
	const recipeId = $derived(`${recipe.dishKey}/${recipe.regionKey}`);
	const back = inAppBack('recipe-back');
</script>

<svelte:head>
	<title>{recipeTitle(recipe.dishName, recipe.name)}</title>
	<meta name="description" content={recipe.description} />
</svelte:head>

<main>
	<StickyTopBar
		backHref={variationsHref(recipe.dishKey, lang)}
		backLabel={m.a11y_back()}
		title={recipe.name}
		threshold={BAR_THRESHOLD_PX}
		onBack={back}
	/>
	<RecipeHeader {recipe} mediaBaseUrl={data.mediaBaseUrl} />
	{#key recipeId}
		<RecipeBody {recipe} {lang} />
	{/key}
</main>
