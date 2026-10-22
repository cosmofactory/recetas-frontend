<script lang="ts">
	import { page } from '$app/state';
	import PageHead from '#lib/components/PageHead.svelte';
	import { homeDescription, homeTitle } from '#lib/components/home/home-head.ts';
	import { ogImageUrl } from '#lib/seo/og-image.ts';
	import { tabFromUrl } from '#lib/ui/home-tab.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The screen itself renders in the (home) layout; region pages set their
	// own title (FE-4 PR 3).
	const title = $derived(homeTitle(tabFromUrl(page.url)));
</script>

<PageHead {title} description={homeDescription()} image={ogImageUrl({ origin: data.origin })} />
