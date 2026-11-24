<script lang="ts">
	import RecipePage from '#lib/components/recipe/RecipePage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<RecipePage {data} />
