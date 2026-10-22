<script lang="ts">
	import { recipeTitle } from '#lib/components/dish/dish-head.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{recipeTitle(data.recipe.dishName, data.recipe.name)}</title>
	<meta name="description" content={data.recipe.description} />
</svelte:head>

<!-- FE-2 stub; the Recipe screen arrives with FE-6 PR 3. -->
<h1>{data.recipe.name}</h1>
