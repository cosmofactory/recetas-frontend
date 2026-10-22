<script lang="ts">
	import PageHead from '#lib/components/PageHead.svelte';
	import { regionTitle } from '#lib/components/home/home-head.ts';
	import { ogImageUrl } from '#lib/seo/og-image.ts';
	import type { PageProps } from './$types';

	// The region renders in the (home) layout (map selection, sheet and
	// panel); the loader validates the key (404) and gives the head its text.
	let { data }: PageProps = $props();
</script>

<PageHead
	title={regionTitle(data.region.name)}
	description={data.region.description}
	image={ogImageUrl({ origin: data.origin })}
/>
