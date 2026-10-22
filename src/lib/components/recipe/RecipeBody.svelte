<script lang="ts">
	import { untrack } from 'svelte';
	import type { components } from '#lib/api/schema.d.ts';
	import { formatRecipeTime } from '#lib/recipe/time.ts';
	import IngredientList from './IngredientList.svelte';
	import MethodSteps from './MethodSteps.svelte';
	import RecipeInfoStrip from './RecipeInfoStrip.svelte';

	type Props = { recipe: components['schemas']['Recipe']; lang: string };

	let { recipe, lang }: Props = $props();

	// In memory only (X6). The page keys this component on the recipe, so
	// another recipe starts again at its base servings with nothing ticked.
	let servings = $state(untrack(() => recipe.baseServings));
	const time = $derived(formatRecipeTime(lang, recipe.timeMinutes, recipe.timeNote));
</script>

<RecipeInfoStrip {time} bind:servings />
<IngredientList
	ingredients={recipe.ingredients}
	baseServings={recipe.baseServings}
	{servings}
	{lang}
/>
<MethodSteps steps={recipe.steps} />
