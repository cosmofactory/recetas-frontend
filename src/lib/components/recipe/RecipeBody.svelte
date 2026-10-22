<script lang="ts">
	import { untrack } from 'svelte';
	import type { components } from '#lib/api/schema.d.ts';
	import { formatRecipeTime } from '#lib/recipe/time.ts';
	import IngredientList from './IngredientList.svelte';
	import MethodSteps from './MethodSteps.svelte';
	import RecipeHeader from './RecipeHeader.svelte';
	import RecipeInfoStrip from './RecipeInfoStrip.svelte';

	type Props = {
		recipe: components['schemas']['Recipe'];
		lang: string;
		mediaBaseUrl: string | undefined;
	};

	let { recipe, lang, mediaBaseUrl }: Props = $props();

	// In memory only (X6). The page keys this component on the recipe, so
	// another recipe starts again at its base servings with nothing ticked.
	// One instance serves both layouts (CSS), so crossing 860px keeps it.
	let servings = $state(untrack(() => recipe.baseServings));
	const time = $derived(formatRecipeTime(lang, recipe.timeMinutes, recipe.timeNote));
</script>

<RecipeHeader {recipe} {mediaBaseUrl}>
	{#snippet strip()}
		<RecipeInfoStrip {time} bind:servings />
	{/snippet}
</RecipeHeader>
<div class="body">
	<IngredientList
		ingredients={recipe.ingredients}
		baseServings={recipe.baseServings}
		{servings}
		{lang}
	/>
	<MethodSteps steps={recipe.steps} />
</div>

<style>
	/*
	 * Desktop README -> Recipe page: "Body grid minmax(300px,380px) 1fr:
	 * ingredients card is sticky (top 24px) while the method scrolls"; the
	 * prototype: "gap:clamp(32px,4.4vw,64px); align-items:start;
	 * padding-top:10px". No bottom padding, so the card's grid area ends where
	 * the grid does.
	 */
	@media (min-width: 860px) {
		.body {
			display: grid;
			grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
			gap: var(--recipe-body-gap-desktop);
			align-items: start;
			padding-top: 10px;
		}
	}
</style>
