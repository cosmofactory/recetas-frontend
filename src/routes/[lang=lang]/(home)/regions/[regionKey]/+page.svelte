<script lang="ts">
	import { regionTitle } from '#lib/components/home/home-head.ts';
	import type { PageProps } from './$types';

	// The region renders in the (home) layout (map selection, sheet and
	// panel); the loader validates the key (404) and gives the head its text.
	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{regionTitle(data.region.name)}</title>
	<meta name="description" content={data.region.description} />
</svelte:head>
